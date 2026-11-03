-- Fila persistente para geração assíncrona de capas de atividades.
CREATE TABLE IF NOT EXISTS public.activity_cover_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt varchar(1000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REVIEW_PENDING', 'FAILED')),
  media_asset_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL,
  error_code varchar(80) NULL,
  error_message varchar(500) NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_cover_jobs_pending
  ON public.activity_cover_generation_jobs (created_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_activity_cover_jobs_user_created
  ON public.activity_cover_generation_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_cover_jobs_processing
  ON public.activity_cover_generation_jobs (started_at)
  WHERE status = 'PROCESSING';
