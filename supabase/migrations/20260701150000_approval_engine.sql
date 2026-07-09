-- Approval Engine: multi-tier approval counts per request
-- Safe (low) = 0 → auto-approved
-- Medium = 1, High = 2, Critical = 3 human approvals required

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS required_approvals INTEGER NOT NULL DEFAULT 1
    CHECK (required_approvals >= 0),
  ADD COLUMN IF NOT EXISTS approvals_received INTEGER NOT NULL DEFAULT 0
    CHECK (approvals_received >= 0);

CREATE INDEX IF NOT EXISTS approval_requests_risk_analysis_idx
  ON public.approval_requests (risk_analysis_id)
  WHERE risk_analysis_id IS NOT NULL;
