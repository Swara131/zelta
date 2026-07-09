-- Audit logging: denormalized fields for timeline queries + composite indexes

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS risk_severity public.risk_severity,
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status;

-- Timeline feed: org-scoped reverse chronological scans
CREATE INDEX IF NOT EXISTS audit_logs_timeline_org_created_idx
  ON public.audit_logs (organization_id, created_at DESC, id DESC)
  WHERE organization_id IS NOT NULL;

-- Filter by action within org
CREATE INDEX IF NOT EXISTS audit_logs_org_action_created_idx
  ON public.audit_logs (organization_id, action, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- User activity history
CREATE INDEX IF NOT EXISTS audit_logs_user_created_id_idx
  ON public.audit_logs (user_id, created_at DESC, id DESC);

COMMENT ON COLUMN public.audit_logs.risk_severity IS 'Risk level at time of action (nullable for non-risk events)';
COMMENT ON COLUMN public.audit_logs.approval_status IS 'Approval disposition at time of action (nullable for non-approval events)';
