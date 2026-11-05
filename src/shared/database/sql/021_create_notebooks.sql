BEGIN;

CREATE TABLE IF NOT EXISTS public.notebook_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.teacher_student_relationships(id) ON DELETE CASCADE,
  day_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_notebook_days_relationship_date UNIQUE (relationship_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_notebook_days_relationship_date
  ON public.notebook_days (relationship_id, day_date DESC);

CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES public.notebook_days(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('TEXT', 'IMAGE', 'ACTIVITY_LINK', 'FILE')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notebook_entries_day_position
  ON public.notebook_entries (day_id, position, created_at);

CREATE TABLE IF NOT EXISTS public.notebook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.teacher_student_relationships(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  parent_id UUID NULL REFERENCES public.notebook_notes(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notebook_notes_relationship_created
  ON public.notebook_notes (relationship_id, created_at);

DROP TRIGGER IF EXISTS trg_notebook_days_updated_at ON public.notebook_days;
CREATE TRIGGER trg_notebook_days_updated_at
BEFORE UPDATE ON public.notebook_days
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notebook_entries_updated_at ON public.notebook_entries;
CREATE TRIGGER trg_notebook_entries_updated_at
BEFORE UPDATE ON public.notebook_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notebook_notes_updated_at ON public.notebook_notes;
CREATE TRIGGER trg_notebook_notes_updated_at
BEFORE UPDATE ON public.notebook_notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
