-- Índice para consultar rapidamente o consumo da biblioteca por professor.
-- O consumo consolidado também considera anexos do caderno e áudios do Listening.
CREATE INDEX IF NOT EXISTS idx_media_assets_storage_quota
  ON public.media_assets (uploaded_by, status);
