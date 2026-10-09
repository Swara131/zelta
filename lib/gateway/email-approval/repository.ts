import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";

export interface EmailApprovalTokenRow {
  id: string;
  organization_id: string;
  action_proposal_id: string;
  reviewer_id: string;
  reviewer_email: string;
  token_hash: string;
  token_prefix: string;
  expires_at: string;
  used_at: string | null;
  used_action: "approve" | "deny" | null;
  created_at: string;
}

const TOKEN_COLUMNS =
  "id, organization_id, action_proposal_id, reviewer_id, reviewer_email, token_hash, token_prefix, expires_at, used_at, used_action, created_at";

export async function insertEmailApprovalToken(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actionProposalId: string;
    reviewerId: string;
    reviewerEmail: string;
    tokenHash: string;
    tokenPrefix: string;
    expiresAt: string;
  }
): Promise<EmailApprovalTokenRow> {
  const { data, error } = await supabase
    .from("email_approval_tokens")
    .insert({
      organization_id: params.organizationId,
      action_proposal_id: params.actionProposalId,
      reviewer_id: params.reviewerId,
      reviewer_email: params.reviewerEmail,
      token_hash: params.tokenHash,
      token_prefix: params.tokenPrefix,
      expires_at: params.expiresAt,
    })
    .select(TOKEN_COLUMNS)
    .single();

  if (error || !data) {
    throw new ProposalError(error?.message ?? "Failed to create email approval token.");
  }

  return data as EmailApprovalTokenRow;
}

export async function findEmailApprovalTokenByHash(
  supabase: SupabaseClient,
  tokenHash: string
): Promise<EmailApprovalTokenRow | null> {
  const { data, error } = await supabase
    .from("email_approval_tokens")
    .select(TOKEN_COLUMNS)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return data ? (data as EmailApprovalTokenRow) : null;
}

/** Atomically marks a token used; returns null if already used or expired. */
export async function consumeEmailApprovalTokenAtomically(
  supabase: SupabaseClient,
  params: {
    tokenHash: string;
    action: "approve" | "deny";
    usedAt: string;
  }
): Promise<EmailApprovalTokenRow | null> {
  const { data, error } = await supabase
    .from("email_approval_tokens")
    .update({
      used_at: params.usedAt,
      used_action: params.action,
    })
    .eq("token_hash", params.tokenHash)
    .is("used_at", null)
    .gt("expires_at", params.usedAt)
    .select(TOKEN_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return data ? (data as EmailApprovalTokenRow) : null;
}
