-- Link Action Passports to approval proposals for the Approval Gate.

DO $$ BEGIN
  ALTER TYPE public.action_passport_status ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.action_passports
  ADD COLUMN IF NOT EXISTS action_proposal_id UUID
    REFERENCES public.action_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS action_passports_proposal_idx
  ON public.action_passports (action_proposal_id)
  WHERE action_proposal_id IS NOT NULL;

COMMENT ON COLUMN public.action_passports.action_proposal_id IS
  'Gateway action proposal this passport was issued for when safety requires human approval.';
