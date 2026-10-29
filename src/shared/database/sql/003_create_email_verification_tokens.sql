BEGIN;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_email_verification_tokens_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_email_verification_tokens_user_id
  ON email_verification_tokens (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_email_verification_tokens_token_hash
  ON email_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS
  idx_email_verification_tokens_expires_at
  ON email_verification_tokens (expires_at);

COMMIT;