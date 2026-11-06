BEGIN;

ALTER TABLE marketplace_products
  ADD COLUMN IF NOT EXISTS publisher_type VARCHAR(12) NOT NULL DEFAULT 'ADMIN'
  CHECK (publisher_type IN ('ADMIN', 'TEACHER'));

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS marketplace_fee_cents INTEGER NOT NULL DEFAULT 0;

DO $$ 
BEGIN
  ALTER TABLE marketplace_orders
    ADD CONSTRAINT chk_marketplace_order_fee
    CHECK (marketplace_fee_cents >= 0 AND marketplace_fee_cents <= amount_cents);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_seller_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mp_user_id VARCHAR(40) NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  public_key TEXT,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_oauth_states (
  state_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_expiration
  ON marketplace_oauth_states(expires_at);

COMMIT;
