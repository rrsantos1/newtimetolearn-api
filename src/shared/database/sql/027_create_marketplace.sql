BEGIN;
CREATE TABLE IF NOT EXISTS marketplace_products(
 id UUID PRIMARY KEY,seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 slug VARCHAR(180) NOT NULL UNIQUE,title VARCHAR(180) NOT NULL,description TEXT NOT NULL,category VARCHAR(40) NOT NULL,
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 1000000),currency CHAR(3) NOT NULL DEFAULT 'BRL',
 original_key TEXT NOT NULL,original_file_name VARCHAR(180) NOT NULL,original_content_type VARCHAR(120) NOT NULL,
 original_size_bytes BIGINT NOT NULL CHECK(original_size_bytes>0),cover_key TEXT NOT NULL,
 preview_pages INTEGER NOT NULL CHECK(preview_pages BETWEEN 1 AND 120),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED','ARCHIVED')),
 published_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_public ON marketplace_products(published_at DESC) WHERE status='PUBLISHED';
CREATE TABLE IF NOT EXISTS marketplace_product_previews(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
 page_number INTEGER NOT NULL CHECK(page_number BETWEEN 1 AND 120),preview_key TEXT NOT NULL UNIQUE,UNIQUE(product_id,page_number)
);
CREATE TABLE IF NOT EXISTS marketplace_orders(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE RESTRICT,
 buyer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,buyer_email VARCHAR(255) NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED','REFUNDED','CANCELLED')),
 provider_preference_id VARCHAR(150),provider_payment_id VARCHAR(150),paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_payment_id ON marketplace_orders(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_buyer ON marketplace_orders(buyer_user_id,paid_at DESC) WHERE status='APPROVED';
CREATE TABLE IF NOT EXISTS marketplace_payment_events(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),provider_event_id VARCHAR(180) NOT NULL UNIQUE,
 order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,payload JSONB NOT NULL,
 processed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE OR REPLACE FUNCTION marketplace_set_product_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base TEXT;
BEGIN base:=trim(both '-' from regexp_replace(lower(NEW.title),'[^a-z0-9]+','-','g'));IF base='' THEN base:='material';END IF;
NEW.slug:=left(base,125)||'-'||replace(NEW.id::text,'-','');RETURN NEW;END;$$;
DROP TRIGGER IF EXISTS trg_marketplace_product_slug ON marketplace_products;
CREATE TRIGGER trg_marketplace_product_slug BEFORE INSERT ON marketplace_products FOR EACH ROW EXECUTE FUNCTION marketplace_set_product_slug();
COMMIT;
