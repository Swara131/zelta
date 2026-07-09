-- Translator sessions (Gemini translation output) and risk analyses

CREATE TABLE IF NOT EXISTS public.translator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT,
  log_content TEXT NOT NULL,
  translations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS translator_sessions_user_created_idx
  ON public.translator_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.risk_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  translator_session_id UUID REFERENCES public.translator_sessions(id) ON DELETE SET NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  total_detected INTEGER NOT NULL DEFAULT 0,
  analyzed_logs INTEGER NOT NULL DEFAULT 0,
  distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_analyses_user_created_idx
  ON public.risk_analyses (user_id, created_at DESC);

ALTER TABLE public.translator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "translator_sessions_select_own" ON public.translator_sessions;
DROP POLICY IF EXISTS "translator_sessions_insert_own" ON public.translator_sessions;
DROP POLICY IF EXISTS "risk_analyses_select_own" ON public.risk_analyses;
DROP POLICY IF EXISTS "risk_analyses_insert_own" ON public.risk_analyses;

CREATE POLICY "translator_sessions_select_own"
  ON public.translator_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "translator_sessions_insert_own"
  ON public.translator_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "risk_analyses_select_own"
  ON public.risk_analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "risk_analyses_insert_own"
  ON public.risk_analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
