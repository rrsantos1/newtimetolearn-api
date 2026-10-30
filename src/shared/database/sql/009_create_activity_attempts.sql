CREATE TABLE IF NOT EXISTS activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  activity_version_id uuid NOT NULL REFERENCES activity_versions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_name varchar(120) NOT NULL,
  words_found text[] NOT NULL DEFAULT '{}',
  total_words integer NOT NULL CHECK (total_words > 0),
  elapsed_seconds integer NOT NULL CHECK (elapsed_seconds >= 0),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  accuracy_points integer NOT NULL CHECK (accuracy_points BETWEEN 0 AND 80),
  speed_points integer NOT NULL CHECK (speed_points BETWEEN 0 AND 20)
);

CREATE INDEX IF NOT EXISTS idx_activity_attempts_activity_score
  ON activity_attempts (activity_id, score DESC, elapsed_seconds ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_activity_attempts_user_created
  ON activity_attempts (user_id, created_at DESC);
