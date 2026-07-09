-- Runtime gateway audit event types (additive enum values)

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'proposal_created';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'policy_allow';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'policy_review';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'policy_block';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'ai_risk_analyzed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'ai_risk_failed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'approval_approved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'approval_rejected';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'token_verified';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'execution_denied';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.gateway_audit_event_type IS
  'Gateway runtime audit events; dotted names stored in metadata.event for UI display.';
