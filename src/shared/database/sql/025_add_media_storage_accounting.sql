-- Limite inicial de armazenamento da biblioteca de mídia por professor.
-- Administradores não consomem cota; a regra é aplicada no serviço.
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS storage_accounted_bytes integer
  GENERATED ALWAYS AS (size_bytes + COALESCE(thumbnail_size_bytes, 0)) STORED;

CREATE INDEX IF NOT EXISTS idx_media_assets_storage_quota
  ON public.media_assets (uploaded_by, status);
