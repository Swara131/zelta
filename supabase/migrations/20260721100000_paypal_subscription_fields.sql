-- PayPal subscription identifiers for webhook-driven billing sync

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_paypal_subscription_unique
  ON public.subscriptions (paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_paypal_subscription_idx
  ON public.subscriptions (paypal_subscription_id);

-- Extend client tamper protection to PayPal billing fields
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
      OR NEW.paypal_subscription_id IS DISTINCT FROM OLD.paypal_subscription_id
      OR NEW.paypal_plan_id IS DISTINCT FROM OLD.paypal_plan_id
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
      AND NEW.stripe_price_id IS NULL
      AND NEW.paypal_subscription_id IS NULL
      AND NEW.paypal_plan_id IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'subscription_insert_forbidden'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
