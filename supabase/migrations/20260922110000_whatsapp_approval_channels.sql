-- WhatsApp approval notification channels (India-first mobile approvals)

ALTER TYPE public.notification_channel ADD VALUE IF NOT EXISTS 'whatsapp';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_email_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_dashboard_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_verified_at TIMESTAMPTZ;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

CREATE INDEX IF NOT EXISTS users_whatsapp_phone_idx
  ON public.users (whatsapp_phone_e164)
  WHERE whatsapp_phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_verification_phone_not_empty CHECK (length(trim(phone_e164)) > 0)
);

CREATE INDEX IF NOT EXISTS whatsapp_verification_user_active_idx
  ON public.whatsapp_verification_codes (user_id, created_at DESC)
  WHERE verified_at IS NULL;

ALTER TABLE public.whatsapp_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_verification_select_self" ON public.whatsapp_verification_codes;
CREATE POLICY "whatsapp_verification_select_self"
  ON public.whatsapp_verification_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "whatsapp_verification_insert_self" ON public.whatsapp_verification_codes;
CREATE POLICY "whatsapp_verification_insert_self"
  ON public.whatsapp_verification_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "whatsapp_verification_update_self" ON public.whatsapp_verification_codes;
CREATE POLICY "whatsapp_verification_update_self"
  ON public.whatsapp_verification_codes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Prevent duplicate active WhatsApp gateway review notifications
CREATE UNIQUE INDEX IF NOT EXISTS notifications_active_gateway_review_whatsapp_dedupe_idx
  ON public.notifications (organization_id, risk_id, recipient_phone, template_type)
  WHERE channel = 'whatsapp'
    AND template_type = 'gateway_review_requested'
    AND delivery_status IN ('pending', 'delivered', 'retrying');

COMMENT ON COLUMN public.users.approval_email_enabled IS
  'Send approval requests via email when true.';
COMMENT ON COLUMN public.users.approval_whatsapp_enabled IS
  'Send approval requests via verified WhatsApp number when true.';
COMMENT ON COLUMN public.users.approval_dashboard_enabled IS
  'Show approval requests in the Zelta dashboard when true.';
COMMENT ON COLUMN public.users.whatsapp_phone_e164 IS
  'E.164 WhatsApp phone number (e.g. +919876543210).';
COMMENT ON COLUMN public.users.whatsapp_phone_verified_at IS
  'When the WhatsApp number was verified via OTP.';
