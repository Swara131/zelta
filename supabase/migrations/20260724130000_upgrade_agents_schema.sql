-- =============================================================================
-- Upgrade agents table to match Zelta builder app schema
-- Run this if you created the simplified agents table and see errors like:
--   "Could not find the 'organization_id' column of 'agents' in the schema cache"
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.agent_record_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns the app requires (safe if already present)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS trigger_type TEXT,
  ADD COLUMN IF NOT EXISTS suggested_threshold INTEGER;

-- Backfill slug for any existing rows (empty table is fine)
UPDATE public.agents
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR trim(slug) = '';

UPDATE public.agents
SET trigger_type = 'webhook'
WHERE trigger_type IS NULL OR trim(trigger_type) = '';

-- Backfill organization_id from user's first org membership
UPDATE public.agents a
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE a.organization_id IS NULL
  AND om.user_id = a.user_id
  AND om.role IN ('owner', 'admin', 'member');

-- Convert status to enum if it was VARCHAR
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'status'
      AND udt_name <> 'agent_record_status'
  ) THEN
    ALTER TABLE public.agents
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.agents
      ALTER COLUMN status TYPE public.agent_record_status
      USING (
        CASE lower(coalesce(status::text, 'draft'))
          WHEN 'live' THEN 'active'::public.agent_record_status
          WHEN 'sandbox' THEN 'draft'::public.agent_record_status
          WHEN 'active' THEN 'active'::public.agent_record_status
          WHEN 'archived' THEN 'archived'::public.agent_record_status
          ELSE 'draft'::public.agent_record_status
        END
      );

    ALTER TABLE public.agents
      ALTER COLUMN status SET DEFAULT 'draft'::public.agent_record_status;
  END IF;
END $$;

-- Enforce NOT NULL after backfill (only when every row has values)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE organization_id IS NULL) THEN
    ALTER TABLE public.agents ALTER COLUMN organization_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE slug IS NULL OR trim(slug) = '') THEN
    ALTER TABLE public.agents ALTER COLUMN slug SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE trigger_type IS NULL OR trim(trigger_type) = '') THEN
    ALTER TABLE public.agents ALTER COLUMN trigger_type SET NOT NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents (user_id);
CREATE INDEX IF NOT EXISTS agents_org_created_idx ON public.agents (organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agents_org_slug_unique_idx ON public.agents (organization_id, slug);

-- Constraints (skip if already exist)
DO $$ BEGIN
  ALTER TABLE public.agents
    ADD CONSTRAINT agents_trigger_type_valid
    CHECK (trigger_type IN ('email', 'webhook', 'schedule'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.agents
    ADD CONSTRAINT agents_slug_not_empty
    CHECK (length(trim(slug)) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS agents_set_updated_at ON public.agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- agent_policies (app uses this name, not "policies")
CREATE TABLE IF NOT EXISTS public.agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  threshold INTEGER,
  auto_allow BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_policies_threshold_positive CHECK (threshold IS NULL OR threshold > 0)
);

CREATE INDEX IF NOT EXISTS idx_policies_agent_id ON public.agent_policies (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_policies_agent_unique_idx ON public.agent_policies (agent_id);

-- RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can create agents" ON public.agents;
DROP POLICY IF EXISTS "Users can update their own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete their own agents" ON public.agents;

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

CREATE POLICY "Users can view policies for their agents"
  ON public.agent_policies FOR SELECT TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage policies for their agents"
  ON public.agent_policies FOR ALL TO authenticated
  USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  )
  WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_policies TO authenticated;

-- Refresh PostgREST schema cache (Supabase API)
NOTIFY pgrst, 'reload schema';
