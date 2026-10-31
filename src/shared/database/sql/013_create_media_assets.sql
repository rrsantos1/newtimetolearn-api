-- Catálogo compartilhado de imagens do TimeToLearn.
-- Execute manualmente no PostgreSQL antes de utilizar a biblioteca de imagens.
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  storage_key varchar(500) NOT NULL UNIQUE,
  public_url text NOT NULL,
  file_name varchar(255) NOT NULL,
  content_type varchar(50) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  alt_text varchar(250) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'))
);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by_created ON public.media_assets (uploaded_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_status_created ON public.media_assets (status, created_at DESC);
