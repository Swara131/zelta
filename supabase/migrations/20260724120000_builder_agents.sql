-- =============================================================================
-- Zelta builder agents + per-agent default policies
-- Run in Supabase SQL Editor (paste entire file) or: supabase db push
-- =============================================================================

-- Requires public.users, public.organizations, and public.set_updated_at()
-- from earlier ApprovalLayer migrations.

DO $$ BEGIN
  CREATE TYPE public.agent_record_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- agents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'zelta-builder',
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_type TEXT NOT NULL,
  suggested_threshold INTEGER,
  status public.agent_record_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agents_name_length CHECK (char_length(trim(name)) > 3 AND char_length(trim(name)) <= 50),
  CONSTRAINT agents_description_length CHECK (char_length(trim(description)) > 10),
  CONSTRAINT agents_trigger_type_valid CHECK (trigger_type IN ('email', 'webhook', 'schedule')),
  CONSTRAINT agents_slug_not_empty CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_agents_user_id
  ON public.agents (user_id);

CREATE INDEX IF NOT EXISTS agents_user_created_idx
  ON public.agents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agents_org_created_idx
  ON public.agents (organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS agents_org_slug_unique_idx
  ON public.agents (organization_id, slug);

DROP TRIGGER IF EXISTS agents_set_updated_at ON public.agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- agent_policies (app code uses this name — not "policies")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  threshold INTEGER,
  auto_allow BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_policies_threshold_positive CHECK (threshold IS NULL OR threshold > 0)
);

CREATE INDEX IF NOT EXISTS idx_policies_agent_id
  ON public.agent_policies (agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS agent_policies_agent_unique_idx
  ON public.agent_policies (agent_id);

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can create agents" ON public.agents;
DROP POLICY IF EXISTS "Users can update their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete their own agents" ON public.agents;
DROP POLICY IF EXISTS "agents_select_own" ON public.agents;
DROP POLICY IF EXISTS "agents_insert_own" ON public.agents;
DROP POLICY IF EXISTS "agents_update_own" ON public.agents;

CREATE POLICY "Users can view their own agents"
  ON public.agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create agents"
  ON public.agents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents"
  ON public.agents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents"
  ON public.agents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view policies for their agents" ON public.agent_policies;
DROP POLICY IF EXISTS "Users can manage policies for their agents" ON public.agent_policies;
DROP POLICY IF EXISTS "agent_policies_select_via_agent" ON public.agent_policies;
DROP POLICY IF EXISTS "agent_policies_insert_via_agent" ON public.agent_policies;

CREATE POLICY "Users can view policies for their agents"
  ON public.agent_policies FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage policies for their agents"
  ON public.agent_policies FOR ALL TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_policies TO authenticated;

COMMENT ON TABLE public.agents IS 'Agents created via the Zelta builder or API.';
COMMENT ON TABLE public.agent_policies IS 'Default protection policy per builder agent.';
