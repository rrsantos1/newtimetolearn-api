ALTER TABLE activity_versions
ADD COLUMN IF NOT EXISTS generated_data JSONB NULL;