-- Scope idempotency keys per organization + agent (not org-wide).
-- Allows independent idempotency namespaces for different agents in the same org.

DROP INDEX IF EXISTS public.action_proposals_org_idempotency_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_org_agent_idempotency_unique_idx
  ON public.action_proposals (organization_id, agent_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
