-- Decision agents — separate from builder/runtime agents

CREATE TABLE IF NOT EXISTS public.decision_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  purpose TEXT NOT NULL,
  decision_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'draft',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployment JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT decision_agents_name_length CHECK (char_length(trim(name)) > 2),
  CONSTRAINT decision_agents_slug_not_empty CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS decision_agents_org_slug_unique_idx
  ON public.decision_agents (organization_id, slug);

CREATE INDEX IF NOT EXISTS decision_agents_user_created_idx
  ON public.decision_agents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.decision_agent_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_agent_id UUID NOT NULL REFERENCES public.decision_agents(id) ON DELETE CASCADE,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_decision TEXT NOT NULL,
  actual_decision TEXT,
  status TEXT NOT NULL DEFAULT 'not_run',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.decision_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_agent_id UUID NOT NULL REFERENCES public.decision_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  input_summary TEXT,
  decision TEXT NOT NULL,
  reasoning_summary TEXT,
  policy_evaluated TEXT,
  risk_result TEXT,
  action_taken TEXT,
  human_approval_required BOOLEAN NOT NULL DEFAULT false,
  final_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_audit_agent_created_idx
  ON public.decision_audit_log (decision_agent_id, created_at DESC);

ALTER TABLE public.decision_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_agent_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decision_agents_select_own"
  ON public.decision_agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "decision_agents_insert_own"
  ON public.decision_agents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decision_agents_update_own"
  ON public.decision_agents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decision_agents_delete_own"
  ON public.decision_agents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "decision_test_cases_via_agent"
  ON public.decision_agent_test_cases FOR ALL TO authenticated
  USING (
    decision_agent_id IN (SELECT id FROM public.decision_agents WHERE user_id = auth.uid())
  )
  WITH CHECK (
    decision_agent_id IN (SELECT id FROM public.decision_agents WHERE user_id = auth.uid())
  );

CREATE POLICY "decision_audit_via_agent"
  ON public.decision_audit_log FOR SELECT TO authenticated
  USING (
    decision_agent_id IN (SELECT id FROM public.decision_agents WHERE user_id = auth.uid())
  );

CREATE POLICY "decision_audit_insert_via_agent"
  ON public.decision_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    decision_agent_id IN (SELECT id FROM public.decision_agents WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_agents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_agent_test_cases TO authenticated;
GRANT SELECT, INSERT ON public.decision_audit_log TO authenticated;

-- Refresh PostgREST schema cache so the API sees new tables immediately
NOTIFY pgrst, 'reload schema';
