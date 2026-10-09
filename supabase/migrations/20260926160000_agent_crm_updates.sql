-- CRM update records for agent support-ticket flows
CREATE TABLE IF NOT EXISTS public.agent_crm_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ticket_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  resolution_details TEXT NOT NULL,
  satisfaction_rating INTEGER,
  status TEXT NOT NULL DEFAULT 'updated',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_crm_updates_ticket_not_empty CHECK (length(trim(ticket_id)) > 0),
  CONSTRAINT agent_crm_updates_customer_not_empty CHECK (length(trim(customer_id)) > 0),
  CONSTRAINT agent_crm_updates_rating_range CHECK (
    satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5)
  )
);

CREATE INDEX IF NOT EXISTS agent_crm_updates_agent_created_idx
  ON public.agent_crm_updates (agent_id, created_at DESC);

ALTER TABLE public.agent_crm_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_crm_updates_via_agent"
  ON public.agent_crm_updates FOR ALL TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_crm_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_crm_updates TO service_role;

NOTIFY pgrst, 'reload schema';
