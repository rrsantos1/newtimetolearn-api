BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'MONTH',
  storage_limit_bytes BIGINT NOT NULL CHECK (storage_limit_bytes > 0),
  student_limit INTEGER NULL CHECK (student_limit IS NULL OR student_limit >= 0),
  removes_ads BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.teacher_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  provider VARCHAR(30) NULL,
  provider_subscription_id VARCHAR(150) NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_subscriptions_provider_reference
  ON public.teacher_subscriptions(provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_subscriptions_teacher_status
  ON public.teacher_subscriptions(teacher_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(30) NOT NULL,
  provider_event_id VARCHAR(180) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_subscription_payment_events_provider_event UNIQUE (provider, provider_event_id)
);

INSERT INTO public.subscription_plans
  (code, name, description, amount_cents, currency, billing_interval, storage_limit_bytes, student_limit, removes_ads)
VALUES
  ('FREE', 'Gratuito', 'Plano gratuito do TimeToLearn.', 0, 'BRL', 'MONTH', 524288000, 5, FALSE),
  ('TEACHER_MONTHLY', 'Professor', 'Mais espaço, alunos ilimitados e experiência sem anúncios.', 590, 'BRL', 'MONTH', 5368709120, NULL, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_cents = EXCLUDED.amount_cents,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  student_limit = EXCLUDED.student_limit,
  removes_ads = EXCLUDED.removes_ads,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
