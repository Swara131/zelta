-- Secure one-time tokens for email approve/deny links (no login required).

CREATE TABLE IF NOT EXISTS public.email_approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_proposal_id uuid NOT NULL REFERENCES public.action_proposals(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewer_email text NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_action text CHECK (used_action IS NULL OR used_action IN ('approve', 'deny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_approval_tokens_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS email_approval_tokens_proposal_idx
  ON public.email_approval_tokens (action_proposal_id);

CREATE INDEX IF NOT EXISTS email_approval_tokens_reviewer_idx
  ON public.email_approval_tokens (reviewer_id, action_proposal_id);

COMMENT ON TABLE public.email_approval_tokens IS
  'One-time hashed tokens for public email approve/deny links. Plaintext shown only in email URLs.';

ALTER TABLE public.email_approval_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_approval_tokens FORCE ROW LEVEL SECURITY;

-- Org members may read tokens for their proposals (optional audit); writes via service_role only.
DROP POLICY IF EXISTS "email_approval_tokens_select" ON public.email_approval_tokens;
CREATE POLICY "email_approval_tokens_select"
  ON public.email_approval_tokens FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON public.email_approval_tokens TO authenticated;
