ALTER TABLE public.activity_attempts
  ADD COLUMN IF NOT EXISTS attempt_token uuid NULL,
  ADD COLUMN IF NOT EXISTS answers jsonb NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_attempts_idempotency
  ON public.activity_attempts (activity_id, user_id, attempt_token)
  WHERE attempt_token IS NOT NULL;
