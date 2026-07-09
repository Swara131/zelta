-- =============================================================================
-- ApprovalLayer — Pre-execution gateway database foundation
-- =============================================================================
-- Additive only: does not modify or drop existing retrospective tables.
-- Gateway writes (proposals, tokens, decisions, audit_events) are intended
-- for service_role API routes; authenticated org members get read access.
-- =============================================================================

-- =============================================================================
-- Enums
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.gateway_proposal_status AS ENUM (
    'pending',
    'allowed',
    'review_required',
    'approved',
    'rejected',
    'blocked',
    'expired',
    'executed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gateway_policy_decision AS ENUM (
    'allow',
    'review',
    'block'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gateway_decision_source AS ENUM (
    'policy',
    'human',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.execution_token_status AS ENUM (
    'active',
    'used',
    'revoked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gateway_audit_event_type AS ENUM (
    'proposal_received',
    'policy_evaluated',
    'risk_scored',
    'decision_recorded',
    'review_requested',
    'human_approved',
    'human_rejected',
    'token_issued',
    'token_consumed',
    'token_revoked',
    'proposal_expired',
    'proposal_executed',
    'callback_dispatched',
    'callback_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- agent_api_keys — hashed credentials for external agent integrations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_api_keys_agent_id_not_empty CHECK (length(trim(agent_id)) > 0),
  CONSTRAINT agent_api_keys_key_prefix_not_empty CHECK (length(trim(key_prefix)) > 0),
  CONSTRAINT agent_api_keys_key_hash_not_empty CHECK (length(trim(key_hash)) > 0),
  CONSTRAINT agent_api_keys_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS agent_api_keys_org_agent_idx
  ON public.agent_api_keys (organization_id, agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS agent_api_keys_hash_unique_idx
  ON public.agent_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS agent_api_keys_org_active_idx
  ON public.agent_api_keys (organization_id, created_at DESC)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS agent_api_keys_set_updated_at ON public.agent_api_keys;
CREATE TRIGGER agent_api_keys_set_updated_at
  BEFORE UPDATE ON public.agent_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- policy_rules — org-scoped gateway policy configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  tool_name_pattern TEXT,
  action_type_pattern TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_decision public.gateway_policy_decision NOT NULL DEFAULT 'review',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT policy_rules_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS policy_rules_org_priority_idx
  ON public.policy_rules (organization_id, priority ASC, created_at ASC)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS policy_rules_org_enabled_idx
  ON public.policy_rules (organization_id, enabled, updated_at DESC);

DROP TRIGGER IF EXISTS policy_rules_set_updated_at ON public.policy_rules;
CREATE TRIGGER policy_rules_set_updated_at
  BEFORE UPDATE ON public.policy_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- action_proposals — pre-execution agent tool call intents
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_hash TEXT NOT NULL,
  plain_english_summary TEXT,
  risk_level public.risk_severity NOT NULL DEFAULT 'medium',
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_decision public.gateway_policy_decision,
  status public.gateway_proposal_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  CONSTRAINT action_proposals_agent_id_not_empty CHECK (length(trim(agent_id)) > 0),
  CONSTRAINT action_proposals_tool_name_not_empty CHECK (length(trim(tool_name)) > 0),
  CONSTRAINT action_proposals_action_type_not_empty CHECK (length(trim(action_type)) > 0),
  CONSTRAINT action_proposals_action_hash_not_empty CHECK (length(trim(action_hash)) > 0),
  CONSTRAINT action_proposals_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS action_proposals_org_status_created_idx
  ON public.action_proposals (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS action_proposals_org_agent_created_idx
  ON public.action_proposals (organization_id, agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS action_proposals_org_expires_idx
  ON public.action_proposals (organization_id, expires_at)
  WHERE status IN ('pending', 'review_required');

CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_org_idempotency_unique_idx
  ON public.action_proposals (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_org_action_hash_unique_idx
  ON public.action_proposals (organization_id, action_hash)
  WHERE status NOT IN ('expired', 'rejected', 'blocked');

DROP TRIGGER IF EXISTS action_proposals_set_updated_at ON public.action_proposals;
CREATE TRIGGER action_proposals_set_updated_at
  BEFORE UPDATE ON public.action_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bridge retrospective approval queue ↔ gateway proposals (nullable, additive)
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS action_proposal_id UUID REFERENCES public.action_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS approval_requests_action_proposal_idx
  ON public.approval_requests (action_proposal_id)
  WHERE action_proposal_id IS NOT NULL;

ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS approval_request_id UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS action_proposals_approval_request_idx
  ON public.action_proposals (approval_request_id)
  WHERE approval_request_id IS NOT NULL;

-- =============================================================================
-- approval_decisions — append-only decision trail for gateway proposals
-- (Distinct from approval_history which tracks retrospective approval_requests.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_proposal_id UUID NOT NULL REFERENCES public.action_proposals(id) ON DELETE CASCADE,
  decision_source public.gateway_decision_source NOT NULL,
  policy_decision public.gateway_policy_decision,
  proposal_status public.gateway_proposal_status NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_decisions_proposal_created_idx
  ON public.approval_decisions (action_proposal_id, created_at ASC);

CREATE INDEX IF NOT EXISTS approval_decisions_org_created_idx
  ON public.approval_decisions (organization_id, created_at DESC);

-- =============================================================================
-- execution_tokens — single-use resume tokens after approval
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.execution_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_proposal_id UUID NOT NULL REFERENCES public.action_proposals(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  status public.execution_token_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT execution_tokens_token_hash_not_empty CHECK (length(trim(token_hash)) > 0),
  CONSTRAINT execution_tokens_token_prefix_not_empty CHECK (length(trim(token_prefix)) > 0),
  CONSTRAINT execution_tokens_expires_after_created CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_tokens_hash_unique_idx
  ON public.execution_tokens (token_hash);

CREATE INDEX IF NOT EXISTS execution_tokens_proposal_status_idx
  ON public.execution_tokens (action_proposal_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS execution_tokens_org_expires_idx
  ON public.execution_tokens (organization_id, expires_at)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS execution_tokens_set_updated_at ON public.execution_tokens;
CREATE TRIGGER execution_tokens_set_updated_at
  BEFORE UPDATE ON public.execution_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- audit_events — gateway-scoped immutable event stream
-- (Complements audit_logs; does not replace retrospective audit trail.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_proposal_id UUID REFERENCES public.action_proposals(id) ON DELETE SET NULL,
  event_type public.gateway_audit_event_type NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  agent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_org_created_idx
  ON public.audit_events (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_events_proposal_created_idx
  ON public.audit_events (action_proposal_id, created_at ASC)
  WHERE action_proposal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_events_org_event_type_idx
  ON public.audit_events (organization_id, event_type, created_at DESC);

-- =============================================================================
-- Append-only guards (gateway audit + decisions)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_gateway_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'audit_events_are_append_only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_events_prevent_update ON public.audit_events;
CREATE TRIGGER audit_events_prevent_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_gateway_audit_event_mutation();

DROP TRIGGER IF EXISTS audit_events_prevent_delete ON public.audit_events;
CREATE TRIGGER audit_events_prevent_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_gateway_audit_event_mutation();

CREATE OR REPLACE FUNCTION public.prevent_approval_decision_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'approval_decisions_are_append_only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS approval_decisions_prevent_update ON public.approval_decisions;
CREATE TRIGGER approval_decisions_prevent_update
  BEFORE UPDATE ON public.approval_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approval_decision_mutation();

DROP TRIGGER IF EXISTS approval_decisions_prevent_delete ON public.approval_decisions;
CREATE TRIGGER approval_decisions_prevent_delete
  BEFORE DELETE ON public.approval_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approval_decision_mutation();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.execution_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

-- agent_api_keys: org members read metadata; admins manage keys (hashes set server-side)
DROP POLICY IF EXISTS "agent_api_keys_select" ON public.agent_api_keys;
DROP POLICY IF EXISTS "agent_api_keys_insert_admin" ON public.agent_api_keys;
DROP POLICY IF EXISTS "agent_api_keys_update_admin" ON public.agent_api_keys;
DROP POLICY IF EXISTS "agent_api_keys_delete_admin" ON public.agent_api_keys;

CREATE POLICY "agent_api_keys_select"
  ON public.agent_api_keys FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "agent_api_keys_insert_admin"
  ON public.agent_api_keys FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "agent_api_keys_update_admin"
  ON public.agent_api_keys FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "agent_api_keys_delete_admin"
  ON public.agent_api_keys FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- policy_rules: org members read; admins manage
DROP POLICY IF EXISTS "policy_rules_select" ON public.policy_rules;
DROP POLICY IF EXISTS "policy_rules_insert_admin" ON public.policy_rules;
DROP POLICY IF EXISTS "policy_rules_update_admin" ON public.policy_rules;
DROP POLICY IF EXISTS "policy_rules_delete_admin" ON public.policy_rules;

CREATE POLICY "policy_rules_select"
  ON public.policy_rules FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "policy_rules_insert_admin"
  ON public.policy_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "policy_rules_update_admin"
  ON public.policy_rules FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "policy_rules_delete_admin"
  ON public.policy_rules FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- action_proposals: org members read; gateway API writes via service_role
DROP POLICY IF EXISTS "action_proposals_select" ON public.action_proposals;

CREATE POLICY "action_proposals_select"
  ON public.action_proposals FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- approval_decisions: org members read; gateway API writes via service_role
DROP POLICY IF EXISTS "approval_decisions_select" ON public.approval_decisions;

CREATE POLICY "approval_decisions_select"
  ON public.approval_decisions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- execution_tokens: org members read; gateway API writes via service_role
DROP POLICY IF EXISTS "execution_tokens_select" ON public.execution_tokens;

CREATE POLICY "execution_tokens_select"
  ON public.execution_tokens FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- audit_events: org members read; gateway API writes via service_role
DROP POLICY IF EXISTS "audit_events_select" ON public.audit_events;

CREATE POLICY "audit_events_select"
  ON public.audit_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Grants (match existing core schema pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_rules TO authenticated;
GRANT SELECT ON public.action_proposals TO authenticated;
GRANT SELECT ON public.approval_decisions TO authenticated;
GRANT SELECT ON public.execution_tokens TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

COMMENT ON TABLE public.action_proposals IS
  'Pre-execution agent tool proposals evaluated by the gateway before execution.';

COMMENT ON TABLE public.approval_decisions IS
  'Append-only gateway decision trail; separate from approval_history on retrospective requests.';

COMMENT ON TABLE public.audit_events IS
  'Gateway-scoped immutable events; complements public.audit_logs for dashboard audit.';

COMMENT ON TABLE public.agent_api_keys IS
  'Hashed API keys for external agents. Plaintext keys are never stored.';

COMMENT ON TABLE public.execution_tokens IS
  'Single-use resume tokens issued after human approval of a gateway proposal.';

COMMENT ON TABLE public.policy_rules IS
  'Organization policy rules for synchronous ALLOW/REVIEW/BLOCK evaluation.';
