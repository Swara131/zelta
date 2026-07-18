-- Prevent concurrent duplicate active gateway review notification deliveries.
-- Failed/bounced rows are excluded so explicit retryNotification can reuse the same record.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_active_gateway_review_dedupe_idx
  ON public.notifications (organization_id, risk_id, recipient_email, template_type)
  WHERE channel = 'email'
    AND template_type = 'gateway_review_requested'
    AND delivery_status IN ('pending', 'delivered', 'retrying');
