ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.onboarding_completed_at IS
  'When the user finished the Zelta welcome onboarding flow.';
COMMENT ON COLUMN public.users.onboarding_responses IS
  'Answers from welcome onboarding (role, goals, familiarity, first build intent).';
