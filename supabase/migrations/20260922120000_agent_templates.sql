-- =============================================================================
-- Agent templates catalog (pre-built agents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL,
  category VARCHAR(64) NOT NULL,
  default_description TEXT NOT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_type TEXT NOT NULL DEFAULT 'webhook',
  supports_threshold BOOLEAN NOT NULL DEFAULT false,
  default_threshold INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_trigger_type_valid CHECK (trigger_type IN ('email', 'webhook', 'schedule')),
  CONSTRAINT templates_default_threshold_positive CHECK (
    default_threshold IS NULL OR default_threshold > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates (category);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.templates;
CREATE POLICY "Authenticated users can read templates"
  ON public.templates FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.templates TO authenticated;

INSERT INTO public.templates (
  id,
  name,
  description,
  summary,
  icon,
  category,
  default_description,
  tools,
  trigger_type,
  supports_threshold,
  default_threshold
) VALUES
  (
    'template-1',
    'Refund Processor',
    'Issue refunds to customers',
    'Automatically send refunds under ₹5,000 and notify customers',
    '💰',
    'e-commerce',
    'Issue refunds to customers when they request cancellations under ₹5,000 and send them confirmation emails',
    '["send_email", "issue_refund"]'::jsonb,
    'webhook',
    true,
    5000
  ),
  (
    'template-2',
    'Email Responder',
    'Auto-reply to customer emails',
    'Send professional replies to customer support emails',
    '📧',
    'support',
    'Send professional replies to customer support emails',
    '["send_email"]'::jsonb,
    'email',
    false,
    NULL
  ),
  (
    'template-3',
    'Appointment Scheduler',
    'Create customer appointments',
    'Auto-schedule meetings and send calendar invites',
    '📅',
    'service',
    'Auto-schedule meetings and send calendar invites',
    '["create_calendar_event", "send_email"]'::jsonb,
    'webhook',
    false,
    NULL
  ),
  (
    'template-4',
    'Lead Follow-up',
    'Nurture abandoned carts',
    'Send personalized follow-ups to website visitors',
    '🎯',
    'marketing',
    'Send personalized follow-ups to website visitors',
    '["send_email", "send_whatsapp_message"]'::jsonb,
    'webhook',
    false,
    NULL
  ),
  (
    'template-5',
    'CRM Updater',
    'Update customer records',
    'Sync customer data from support tickets',
    '👥',
    'operations',
    'Sync customer data from support tickets',
    '["update_crm_record"]'::jsonb,
    'webhook',
    false,
    NULL
  ),
  (
    'template-6',
    'Alert Monitor',
    'Monitor system alerts',
    'Notify team when critical issues occur',
    '🚨',
    'operations',
    'Notify team when critical issues occur',
    '["send_email"]'::jsonb,
    'webhook',
    false,
    NULL
  ),
  (
    'template-7',
    'Invoice Generator',
    'Generate and send invoices',
    'Auto-create invoices for high-value orders',
    '📄',
    'finance',
    'Auto-create invoices for high-value orders',
    '["send_email"]'::jsonb,
    'webhook',
    true,
    10000
  ),
  (
    'template-8',
    'SMS Notifier',
    'Send SMS notifications',
    'Alert customers via SMS for important updates',
    '📱',
    'marketing',
    'Alert customers via SMS for important updates',
    '["send_whatsapp_message"]'::jsonb,
    'webhook',
    false,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.templates IS 'Pre-built agent templates for quick onboarding.';
