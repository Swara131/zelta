-- Review deadline for pending human review (separate from overall proposal expires_at)

ALTER TABLE public.action_proposals
  ADD COLUMN IF NOT EXISTS review_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.action_proposals.review_expires_at IS
  'Deadline for human review when status is review_required; set when review is requested.';

-- Backfill active reviews so deadline enforcement applies immediately
UPDATE public.action_proposals
SET review_expires_at = expires_at
WHERE status = 'review_required'
  AND review_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS action_proposals_org_review_expires_idx
  ON public.action_proposals (organization_id, review_expires_at)
  WHERE status = 'review_required';
