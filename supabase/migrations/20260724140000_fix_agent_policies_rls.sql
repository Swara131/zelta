-- Fix agent_policies RLS so authenticated users can insert policies for their agents

ALTER TABLE public.agent_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view policies for their agents" ON public.agent_policies;
DROP POLICY IF EXISTS "Users can manage policies for their agents" ON public.agent_policies;
DROP POLICY IF EXISTS "agent_policies_select_via_agent" ON public.agent_policies;
DROP POLICY IF EXISTS "agent_policies_insert_via_agent" ON public.agent_policies;
DROP POLICY IF EXISTS "agent_policies_all_via_agent" ON public.agent_policies;

CREATE POLICY "agent_policies_select_via_agent"
  ON public.agent_policies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_policies.agent_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_policies_insert_via_agent"
  ON public.agent_policies FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_policies.agent_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_policies_update_via_agent"
  ON public.agent_policies FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_policies.agent_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_policies.agent_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_policies_delete_via_agent"
  ON public.agent_policies FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_policies.agent_id AND a.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_policies TO authenticated;

NOTIFY pgrst, 'reload schema';
