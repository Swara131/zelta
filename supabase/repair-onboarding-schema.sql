-- Run once in Supabase Dashboard → SQL Editor if onboarding, approvals, or
-- agent tests fail with "schema cache", "updated_at", or missing column errors.

-- Gateway review deadlines (required for /approvals and test proposals)
ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS review_expires_at TIMESTAMPTZ;

UPDATE public.action_proposals
SET review_expires_at = expires_at
WHERE status = 'review_required'
  AND review_expires_at IS NULL;

-- Required for profile UPDATE triggers
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Onboarding answers on the user profile
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Avoid signup trigger writing updated_at when the column was missing
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;
