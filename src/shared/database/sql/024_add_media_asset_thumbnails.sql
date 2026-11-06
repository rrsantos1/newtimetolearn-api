-- Metadados das miniaturas geradas no processamento das imagens.
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS thumbnail_storage_key varchar(500),
  ADD COLUMN IF NOT EXISTS thumbnail_public_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_size_bytes integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_thumbnail_storage_key
  ON public.media_assets (thumbnail_storage_key)
  WHERE thumbnail_storage_key IS NOT NULL;
