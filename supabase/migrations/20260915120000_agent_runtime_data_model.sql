-- =============================================================================
-- Zelta internal agent runtime — data model (Phase 2)
-- Extends public.agents; adds runs, actions, tool executions, schedules.
-- Reuses: action_proposals, approval_decisions, audit_logs, audit_events.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend agent lifecycle status (keep draft | active | archived for compat)
-- -----------------------------------------------------------------------------
ALTER TYPE public.agent_record_status ADD VALUE IF NOT EXISTS 'testing';
ALTER TYPE public.agent_record_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE public.agent_record_status ADD VALUE IF NOT EXISTS 'paused';

DO $$ BEGIN
  CREATE TYPE public.agent_run_status AS ENUM (
    'pending',
    'running',
    'awaiting_approval',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_run_mode AS ENUM (
    'test',
    'manual',
    'scheduled',
    'live'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_action_status AS ENUM (
    'proposed',
    'allowed',
    'review_required',
    'approved',
    'rejected',
    'blocked',
    'executed',
    'failed',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tool_execution_status AS ENUM (
    'pending',
    'running',
    'succeeded',
    'failed',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Extend agents — runtime configuration (additive, nullable defaults)
-- -----------------------------------------------------------------------------
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS goal TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.agents.tools IS
  'Enabled tool/capability IDs for this agent (legacy builder field).';
COMMENT ON COLUMN public.agents.capabilities IS
  'Human-facing capability metadata; enabled IDs should mirror tools where possible.';
COMMENT ON COLUMN public.agents.schedule IS
  'When the agent works: frequency, time, days, start/end (JSON).';
COMMENT ON COLUMN public.agents.safety_settings IS
  'Per-agent protection overrides (approval rules, limits).';
COMMENT ON COLUMN public.agents.model IS
  'Preferred AI model identifier for internal runtime (provider-specific slug).';

-- Backfill goal from description where empty
UPDATE public.agents
SET goal = description
WHERE goal IS NULL OR trim(goal) = '';

-- Older projects may have public.agents without updated_at (required below).
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS agents_set_updated_at ON public.agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS agents_user_status_idx
  ON public.agents (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS agents_published_at_idx
  ON public.agents (user_id, published_at DESC NULLS LAST)
  WHERE published_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- agent_runs — each test, manual, or scheduled execution
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status public.agent_run_status NOT NULL DEFAULT 'pending',
  mode public.agent_run_mode NOT NULL DEFAULT 'manual',
  trigger_source TEXT,
  summary TEXT,
  error_message TEXT,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_runs_agent_id_not_empty CHECK (agent_id IS NOT NULL),
  CONSTRAINT agent_runs_finished_after_started CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS agent_runs_agent_created_idx
  ON public.agent_runs (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_user_created_idx
  ON public.agent_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_org_status_idx
  ON public.agent_runs (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_agent_status_idx
  ON public.agent_runs (agent_id, status, created_at DESC);

DROP TRIGGER IF EXISTS agent_runs_set_updated_at ON public.agent_runs;
CREATE TRIGGER agent_runs_set_updated_at
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- agent_run_steps — human-readable progress for a run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 0,
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_run_steps_step_key_not_empty CHECK (length(trim(step_key)) > 0),
  CONSTRAINT agent_run_steps_label_not_empty CHECK (length(trim(label)) > 0)
);

CREATE INDEX IF NOT EXISTS agent_run_steps_run_sequence_idx
  ON public.agent_run_steps (agent_run_id, sequence ASC, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS agent_run_steps_run_step_key_unique_idx
  ON public.agent_run_steps (agent_run_id, step_key);

-- -----------------------------------------------------------------------------
-- agent_actions — links a run to gateway proposals (approvals reuse proposals)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_proposal_id UUID REFERENCES public.action_proposals(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  summary TEXT,
  status public.agent_action_status NOT NULL DEFAULT 'proposed',
  policy_decision public.gateway_policy_decision,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_actions_tool_name_not_empty CHECK (length(trim(tool_name)) > 0),
  CONSTRAINT agent_actions_action_type_not_empty CHECK (length(trim(action_type)) > 0)
);

CREATE INDEX IF NOT EXISTS agent_actions_run_sequence_idx
  ON public.agent_actions (agent_run_id, sequence ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS agent_actions_agent_created_idx
  ON public.agent_actions (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_actions_proposal_idx
  ON public.agent_actions (action_proposal_id)
  WHERE action_proposal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_actions_user_status_idx
  ON public.agent_actions (user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS agent_actions_set_updated_at ON public.agent_actions;
CREATE TRIGGER agent_actions_set_updated_at
  BEFORE UPDATE ON public.agent_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tool_executions — actual tool handler invocations (post-approval)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  agent_action_id UUID REFERENCES public.agent_actions(id) ON DELETE SET NULL,
  action_proposal_id UUID REFERENCES public.action_proposals(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  status public.tool_execution_status NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tool_executions_tool_name_not_empty CHECK (length(trim(tool_name)) > 0),
  CONSTRAINT tool_executions_finished_after_started CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS tool_executions_run_created_idx
  ON public.tool_executions (agent_run_id, created_at ASC)
  WHERE agent_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tool_executions_action_idx
  ON public.tool_executions (agent_action_id)
  WHERE agent_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tool_executions_agent_created_idx
  ON public.tool_executions (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tool_executions_user_status_idx
  ON public.tool_executions (user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS tool_executions_set_updated_at ON public.tool_executions;
CREATE TRIGGER tool_executions_set_updated_at
  BEFORE UPDATE ON public.tool_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- agent_schedules — recurring execution config (one active row per agent)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'manual',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_schedules_frequency_not_empty CHECK (length(trim(frequency)) > 0),
  CONSTRAINT agent_schedules_frequency_valid CHECK (
    frequency IN ('manual', 'daily', 'weekly', 'monthly', 'custom')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_schedules_agent_unique_idx
  ON public.agent_schedules (agent_id);

CREATE INDEX IF NOT EXISTS agent_schedules_next_run_idx
  ON public.agent_schedules (next_run_at ASC)
  WHERE enabled = true AND next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_schedules_user_enabled_idx
  ON public.agent_schedules (user_id, enabled, updated_at DESC);

DROP TRIGGER IF EXISTS agent_schedules_set_updated_at ON public.agent_schedules;
CREATE TRIGGER agent_schedules_set_updated_at
  BEFORE UPDATE ON public.agent_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bridge gateway proposals + audit to builder agents / runs (reuse, no dupes)
-- Approvals: still action_proposals + approval_decisions
-- Activity: still audit_logs + audit_events (+ agent_run_id for filtering)
-- -----------------------------------------------------------------------------
ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS builder_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS action_proposals_builder_agent_idx
  ON public.action_proposals (builder_agent_id, created_at DESC)
  WHERE builder_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS action_proposals_agent_run_idx
  ON public.action_proposals (agent_run_id, created_at ASC)
  WHERE agent_run_id IS NOT NULL;

ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS builder_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_events_agent_run_idx
  ON public.audit_events (agent_run_id, created_at ASC)
  WHERE agent_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_events_builder_agent_idx
  ON public.audit_events (builder_agent_id, created_at DESC)
  WHERE builder_agent_id IS NOT NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS builder_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_logs_builder_agent_idx
  ON public.audit_logs (builder_agent_id, created_at DESC)
  WHERE builder_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_agent_run_idx
  ON public.audit_logs (agent_run_id, created_at ASC)
  WHERE agent_run_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RLS helpers — user owns builder agent (strict per-user access for runtime)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_owns_builder_agent(p_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agents
    WHERE id = p_agent_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_agent_run(p_run_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_runs
    WHERE id = p_run_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_builder_agent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_agent_run(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_builder_agent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_agent_run(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Row level security — runtime tables (user-scoped via agent ownership)
-- -----------------------------------------------------------------------------
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tool_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_schedules FORCE ROW LEVEL SECURITY;

-- agent_runs
DROP POLICY IF EXISTS "agent_runs_select_own" ON public.agent_runs;
DROP POLICY IF EXISTS "agent_runs_insert_own" ON public.agent_runs;
DROP POLICY IF EXISTS "agent_runs_update_own" ON public.agent_runs;
DROP POLICY IF EXISTS "agent_runs_delete_own" ON public.agent_runs;

CREATE POLICY "agent_runs_select_own"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agent_runs_insert_own"
  ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_builder_agent(agent_id)
  );

CREATE POLICY "agent_runs_update_own"
  ON public.agent_runs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_runs_delete_own"
  ON public.agent_runs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- agent_run_steps
DROP POLICY IF EXISTS "agent_run_steps_select_own" ON public.agent_run_steps;
DROP POLICY IF EXISTS "agent_run_steps_insert_own" ON public.agent_run_steps;
DROP POLICY IF EXISTS "agent_run_steps_update_own" ON public.agent_run_steps;
DROP POLICY IF EXISTS "agent_run_steps_delete_own" ON public.agent_run_steps;

CREATE POLICY "agent_run_steps_select_own"
  ON public.agent_run_steps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agent_run_steps_insert_own"
  ON public.agent_run_steps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_agent_run(agent_run_id)
  );

CREATE POLICY "agent_run_steps_update_own"
  ON public.agent_run_steps FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_run_steps_delete_own"
  ON public.agent_run_steps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- agent_actions
DROP POLICY IF EXISTS "agent_actions_select_own" ON public.agent_actions;
DROP POLICY IF EXISTS "agent_actions_insert_own" ON public.agent_actions;
DROP POLICY IF EXISTS "agent_actions_update_own" ON public.agent_actions;
DROP POLICY IF EXISTS "agent_actions_delete_own" ON public.agent_actions;

CREATE POLICY "agent_actions_select_own"
  ON public.agent_actions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agent_actions_insert_own"
  ON public.agent_actions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_builder_agent(agent_id)
    AND public.user_owns_agent_run(agent_run_id)
  );

CREATE POLICY "agent_actions_update_own"
  ON public.agent_actions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_actions_delete_own"
  ON public.agent_actions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- tool_executions
DROP POLICY IF EXISTS "tool_executions_select_own" ON public.tool_executions;
DROP POLICY IF EXISTS "tool_executions_insert_own" ON public.tool_executions;
DROP POLICY IF EXISTS "tool_executions_update_own" ON public.tool_executions;
DROP POLICY IF EXISTS "tool_executions_delete_own" ON public.tool_executions;

CREATE POLICY "tool_executions_select_own"
  ON public.tool_executions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "tool_executions_insert_own"
  ON public.tool_executions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_builder_agent(agent_id)
  );

CREATE POLICY "tool_executions_update_own"
  ON public.tool_executions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tool_executions_delete_own"
  ON public.tool_executions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- agent_schedules
DROP POLICY IF EXISTS "agent_schedules_select_own" ON public.agent_schedules;
DROP POLICY IF EXISTS "agent_schedules_insert_own" ON public.agent_schedules;
DROP POLICY IF EXISTS "agent_schedules_update_own" ON public.agent_schedules;
DROP POLICY IF EXISTS "agent_schedules_delete_own" ON public.agent_schedules;

CREATE POLICY "agent_schedules_select_own"
  ON public.agent_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agent_schedules_insert_own"
  ON public.agent_schedules FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_builder_agent(agent_id)
  );

CREATE POLICY "agent_schedules_update_own"
  ON public.agent_schedules FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_schedules_delete_own"
  ON public.agent_schedules FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_run_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated;

COMMENT ON TABLE public.agent_runs IS
  'Internal Zelta agent executions (test, manual, scheduled, live).';
COMMENT ON TABLE public.agent_run_steps IS
  'Human-readable progress steps for agent runs.';
COMMENT ON TABLE public.agent_actions IS
  'Agent actions within a run; links to gateway action_proposals for approvals.';
COMMENT ON TABLE public.tool_executions IS
  'Records of tool handler invocations after Zelta control layer allows execution.';
COMMENT ON TABLE public.agent_schedules IS
  'When a published agent should run automatically.';
COMMENT ON TABLE public.approval_decisions IS
  'Reused for human approvals — linked via agent_actions.action_proposal_id.';
COMMENT ON TABLE public.audit_logs IS
  'Reused for activity feed — filter by builder_agent_id or agent_run_id.';

NOTIFY pgrst, 'reload schema';
