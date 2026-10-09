-- Short-lived Action Passports bind an exact authorized agent action before tool execution.

DO $$ BEGIN
  CREATE TYPE public.action_passport_status AS ENUM ('active', 'used', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.action_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  builder_agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  gateway_agent_id TEXT NOT NULL,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  agent_action_id UUID REFERENCES public.agent_actions(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_hash TEXT NOT NULL,
  parameters_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  mission_goal TEXT,
  safety_decision TEXT NOT NULL,
  status public.action_passport_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT action_passports_tool_name_not_empty CHECK (length(trim(tool_name)) > 0),
  CONSTRAINT action_passports_action_type_not_empty CHECK (length(trim(action_type)) > 0),
  CONSTRAINT action_passports_safety_decision_not_empty CHECK (length(trim(safety_decision)) > 0)
);

CREATE INDEX IF NOT EXISTS action_passports_run_status_idx
  ON public.action_passports (agent_run_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS action_passports_agent_created_idx
  ON public.action_passports (builder_agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS action_passports_hash_idx
  ON public.action_passports (action_hash);

COMMENT ON TABLE public.action_passports IS
  'Single-use short-lived authorization records binding an exact agent tool action before execution.';

ALTER TABLE public.action_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_passports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_passports_select" ON public.action_passports;
CREATE POLICY "action_passports_select"
  ON public.action_passports FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON public.action_passports TO authenticated;
