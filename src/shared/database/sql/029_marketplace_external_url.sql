BEGIN;

ALTER TABLE marketplace_products
  ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) NOT NULL DEFAULT 'FILE'
    CHECK (delivery_type IN ('FILE', 'EXTERNAL_URL')),
  ADD COLUMN IF NOT EXISTS external_url TEXT;

ALTER TABLE marketplace_products
  ALTER COLUMN original_key DROP NOT NULL,
  ALTER COLUMN original_file_name DROP NOT NULL,
  ALTER COLUMN original_content_type DROP NOT NULL,
  ALTER COLUMN original_size_bytes DROP NOT NULL,
  ALTER COLUMN cover_key DROP NOT NULL,
  ALTER COLUMN preview_pages SET DEFAULT 0,
  ALTER COLUMN preview_pages DROP NOT NULL;

ALTER TABLE marketplace_products
  DROP CONSTRAINT IF EXISTS marketplace_products_preview_pages_check;

ALTER TABLE marketplace_products
  ADD CONSTRAINT marketplace_products_preview_pages_check
  CHECK (preview_pages BETWEEN 0 AND 120);

ALTER TABLE marketplace_products
  ADD CONSTRAINT chk_marketplace_delivery_fields
  CHECK (
    (delivery_type = 'FILE'
      AND original_key IS NOT NULL
      AND original_file_name IS NOT NULL
      AND original_content_type IS NOT NULL
      AND original_size_bytes IS NOT NULL
      AND cover_key IS NOT NULL
      AND preview_pages BETWEEN 1 AND 120
      AND external_url IS NULL)
    OR
    (delivery_type = 'EXTERNAL_URL'
      AND external_url IS NOT NULL
      AND original_key IS NULL
      AND original_file_name IS NULL
      AND original_content_type IS NULL
      AND original_size_bytes IS NULL
      AND cover_key IS NULL
      AND preview_pages = 0)
  );

COMMIT;
