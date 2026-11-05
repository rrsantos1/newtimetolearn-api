BEGIN;

DO $$
BEGIN
  CREATE TYPE teacher_student_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.teacher_student_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status teacher_student_status NOT NULL DEFAULT 'PENDING',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_teacher_student_different_users CHECK (teacher_id <> student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_student_teacher_status
  ON public.teacher_student_relationships (teacher_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_student_student_status
  ON public.teacher_student_relationships (student_id, status, created_at DESC);

-- Um único vínculo ativo por aluno.
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_student_one_active_per_student
  ON public.teacher_student_relationships (student_id)
  WHERE status = 'ACTIVE';

-- Evita convites repetidos em paralelo para o mesmo professor/aluno.
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_student_pending_pair
  ON public.teacher_student_relationships (teacher_id, student_id)
  WHERE status = 'PENDING';

DROP TRIGGER IF EXISTS trg_teacher_student_relationships_updated_at
  ON public.teacher_student_relationships;

CREATE TRIGGER trg_teacher_student_relationships_updated_at
BEFORE UPDATE ON public.teacher_student_relationships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
