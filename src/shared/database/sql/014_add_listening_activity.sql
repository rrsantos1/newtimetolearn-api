BEGIN;

-- Register Listening as a supported activity type.
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS chk_activities_type;

ALTER TABLE public.activities
  ADD CONSTRAINT chk_activities_type
  CHECK (
    type IN (
      'quiz',
      'word_search',
      'crossword',
      'cloze',
      'multiple_choice',
      'fill_in_the_blank',
      'drag_drop',
      'sentence_order',
      'board_game',
      'roulette',
      'hangman',
      'memory',
      'listening',
      'fill_in_blanks',
      'mole_hit'
    )
  );

-- Listening content is versioned inside activity_versions.content (JSONB).
-- Only execution results require a dedicated table because activity_attempts
-- currently contains word-search-specific fields.
CREATE TABLE IF NOT EXISTS public.listening_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  activity_version_id uuid NOT NULL REFERENCES public.activity_versions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  student_name varchar(120) NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_blanks integer NOT NULL CHECK (total_blanks > 0),
  correct_blanks integer NOT NULL CHECK (correct_blanks >= 0 AND correct_blanks <= total_blanks),
  elapsed_seconds integer NOT NULL CHECK (elapsed_seconds >= 0),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT chk_listening_attempts_answers_array
    CHECK (jsonb_typeof(answers) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_listening_attempts_activity_score
  ON public.listening_attempts (activity_id, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_listening_attempts_user_created
  ON public.listening_attempts (user_id, created_at DESC);

COMMIT;
