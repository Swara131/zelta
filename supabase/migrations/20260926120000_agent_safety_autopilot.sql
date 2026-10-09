-- =============================================================================
-- Zelta Safety Autopilot — incidents + normalized policy entities
-- Policy config is also stored in agents.safety_settings.autopilot (JSON).
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.safety_incident_severity AS ENUM (
    'info', 'warning', 'blocked', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tool_permission_level AS ENUM (
    'disabled', 'read_only', 'draft_only', 'ask_approval', 'automatic'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.protection_mode AS ENUM ('safe', 'balanced', 'autonomous');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- agent_safety_policies
CREATE TABLE IF NOT EXISTS public.agent_safety_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  protection_mode public.protection_mode NOT NULL DEFAULT 'balanced',
  prompt_injection_defense BOOLEAN NOT NULL DEFAULT true,
  secret_detection BOOLEAN NOT NULL DEFAULT true,
  pii_detection BOOLEAN NOT NULL DEFAULT true,
  block_prompt_extraction BOOLEAN NOT NULL DEFAULT true,
  restrict_sensitive_kb BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_safety_policies_agent_unique UNIQUE (agent_id)
);

-- agent_tool_permissions
CREATE TABLE IF NOT EXISTS public.agent_tool_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  tool_label TEXT NOT NULL,
  permission_level public.tool_permission_level NOT NULL DEFAULT 'read_only',
  is_high_risk BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_tool_permissions_agent_tool_unique UNIQUE (agent_id, tool_id)
);

-- agent_approval_rules
CREATE TABLE IF NOT EXISTS public.agent_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_value NUMERIC,
  threshold_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_approval_rules_agent_key_unique UNIQUE (agent_id, rule_key)
);

-- agent_execution_limits
CREATE TABLE IF NOT EXISTS public.agent_execution_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_cost_per_run_usd NUMERIC,
  daily_spending_cap_usd NUMERIC,
  max_tool_calls_per_run INTEGER,
  max_execution_time_seconds INTEGER,
  max_retries INTEGER,
  max_messages_per_run INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_execution_limits_agent_unique UNIQUE (agent_id)
);

-- safety_incidents (activity timeline)
CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  severity public.safety_incident_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  related_tool TEXT,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  action_taken TEXT NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_incidents_agent_created_idx
  ON public.safety_incidents (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS safety_incidents_org_severity_idx
  ON public.safety_incidents (organization_id, severity, created_at DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS agent_safety_policies_set_updated_at ON public.agent_safety_policies;
CREATE TRIGGER agent_safety_policies_set_updated_at
  BEFORE UPDATE ON public.agent_safety_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS agent_tool_permissions_set_updated_at ON public.agent_tool_permissions;
CREATE TRIGGER agent_tool_permissions_set_updated_at
  BEFORE UPDATE ON public.agent_tool_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS agent_approval_rules_set_updated_at ON public.agent_approval_rules;
CREATE TRIGGER agent_approval_rules_set_updated_at
  BEFORE UPDATE ON public.agent_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS agent_execution_limits_set_updated_at ON public.agent_execution_limits;
CREATE TRIGGER agent_execution_limits_set_updated_at
  BEFORE UPDATE ON public.agent_execution_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (agent owner access)
ALTER TABLE public.agent_safety_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_safety_policies_via_agent"
  ON public.agent_safety_policies FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "agent_tool_permissions_via_agent"
  ON public.agent_tool_permissions FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "agent_approval_rules_via_agent"
  ON public.agent_approval_rules FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "agent_execution_limits_via_agent"
  ON public.agent_execution_limits FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "safety_incidents_select_via_agent"
  ON public.safety_incidents FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

CREATE POLICY "safety_incidents_insert_via_agent"
  ON public.safety_incidents FOR INSERT TO authenticated
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_safety_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tool_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_approval_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_execution_limits TO authenticated;
GRANT SELECT, INSERT ON public.safety_incidents TO authenticated;

NOTIFY pgrst, 'reload schema';
