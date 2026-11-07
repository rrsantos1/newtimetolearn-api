BEGIN;

ALTER TABLE marketplace_products
  DROP CONSTRAINT IF EXISTS chk_marketplace_delivery_fields;

ALTER TABLE marketplace_products
  ADD CONSTRAINT chk_marketplace_delivery_fields
  CHECK (
    (delivery_type = 'FILE'
      AND original_key IS NOT NULL
      AND original_file_name IS NOT NULL
      AND original_content_type IS NOT NULL
      AND original_size_bytes IS NOT NULL
      AND cover_key IS NOT NULL
      AND preview_pages IS NOT NULL
      AND preview_pages BETWEEN 1 AND 120
      AND external_url IS NULL)
    OR
    (delivery_type = 'EXTERNAL_URL'
      AND external_url IS NOT NULL
      AND original_key IS NULL
      AND original_file_name IS NULL
      AND original_content_type IS NULL
      AND original_size_bytes IS NULL
      AND preview_pages IS NOT NULL
      AND (
        (cover_key IS NULL AND preview_pages = 0)
        OR (cover_key IS NOT NULL AND preview_pages BETWEEN 1 AND 120)
      ))
  );

COMMIT;
