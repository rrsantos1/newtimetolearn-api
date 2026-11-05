BEGIN;

ALTER TABLE public.notebook_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notebook_entries_active_day_position
  ON public.notebook_entries (day_id, position, created_at)
  WHERE deleted_at IS NULL;

COMMIT;
