BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_activity_favorites_user_activity UNIQUE (user_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_favorites_activity
  ON public.activity_favorites (activity_id);

DROP TRIGGER IF EXISTS trg_activity_favorites_updated_at ON public.activity_favorites;
CREATE TRIGGER trg_activity_favorites_updated_at
BEFORE UPDATE ON public.activity_favorites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
