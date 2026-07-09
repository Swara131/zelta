-- Email notification delivery metadata (Resend integration)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS template_type TEXT,
  ADD COLUMN IF NOT EXISTS template_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS notifications_failed_retry_idx
  ON public.notifications (delivery_status, retry_count)
  WHERE delivery_status IN ('failed', 'bounced') AND retry_count < max_retries;
