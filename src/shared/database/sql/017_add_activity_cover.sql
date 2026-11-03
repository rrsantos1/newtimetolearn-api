ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS cover_media_asset_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_activities_cover_media_asset'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT fk_activities_cover_media_asset
      FOREIGN KEY (cover_media_asset_id)
      REFERENCES media_assets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_cover_media_asset
  ON activities (cover_media_asset_id);
