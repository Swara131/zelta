-- Security hardening: force RLS, subscription tamper protection, immutable audit trail

-- =============================================================================
-- Force RLS (table owners bypass unless FORCE is set — prevents owner bypass)
-- =============================================================================

ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.risk_analysis FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.translator_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.risk_analyses FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- Subscriptions: read-only for clients; Stripe webhooks use service_role
-- =============================================================================

DROP POLICY IF EXISTS "subscriptions_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON public.subscriptions;

-- Members can view org subscription; mutations only via service_role (webhooks)
-- Bootstrap trigger runs as SECURITY DEFINER and bypasses RLS.

CREATE OR REPLACE FUNCTION public.prevent_client_subscription_billing_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
      OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
      OR NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id
      OR NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
      OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
      OR NEW.cancel_at_period_end IS DISTINCT FROM OLD.cancel_at_period_end
      OR NEW.canceled_at IS DISTINCT FROM OLD.canceled_at
      OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
    THEN
      RAISE EXCEPTION 'subscription_billing_readonly'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NEW.plan = 'free'
      AND NEW.stripe_customer_id IS NULL
      AND NEW.stripe_subscription_id IS NULL
      AND NEW.stripe_price_id IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'subscription_insert_forbidden'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_prevent_client_tamper ON public.subscriptions;
CREATE TRIGGER subscriptions_prevent_client_tamper
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_subscription_billing_tamper();

-- =============================================================================
-- Audit logs: append-only (no UPDATE/DELETE policies for authenticated)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'audit_logs_are_append_only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_prevent_update ON public.audit_logs;
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- =============================================================================
-- Storage: immutable uploads (no UPDATE on log-uploads bucket)
-- =============================================================================

DROP POLICY IF EXISTS "log_uploads_update_own" ON storage.objects;

COMMENT ON FUNCTION public.prevent_client_subscription_billing_tamper IS
  'Blocks authenticated clients from modifying Stripe-managed subscription fields (OWASP A01).';

COMMENT ON FUNCTION public.prevent_audit_log_mutation IS
  'Ensures audit trail integrity — append-only for non-service roles (OWASP A09).';
