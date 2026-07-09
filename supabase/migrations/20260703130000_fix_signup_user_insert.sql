-- =============================================================================
-- SIGNUP FIX — paste ALL of this in Supabase SQL Editor and click Run
-- =============================================================================
-- The auth trigger fails when FORCE RLS is on public.users. Remove the trigger;
-- the app creates public.users after signup via /api/auth/bootstrap.

-- 1. Remove the broken trigger (required for signup to succeed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Allow the app to insert the user's own profile row
ALTER TABLE public.users NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Verify trigger is gone (should return 0 rows)
SELECT tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND tgname = 'on_auth_user_created';
