import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import type { ExecutionTokenRow } from "./types";

const TOKEN_COLUMNS =
  "id, organization_id, action_proposal_id, token_hash, token_prefix, status, expires_at, used_at, revoked_at, created_at, updated_at";

export async function getProposalForAgentExecution(
  supabase: SupabaseClient,
  params: { proposalId: string; organizationId: string; agentId: string }
): Promise<ActionProposalRow | null> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select(
      "id, organization_id, agent_id, tool_name, action_type, action_payload, action_hash, plain_english_summary, risk_level, risk_score, risk_reasons, policy_decision, status, requested_by, idempotency_key, created_at, updated_at, expires_at, decided_at, executed_at"
    )
    .eq("id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  const row = data as ActionProposalRow | null;
  if (!row) {
    return null;
  }

  if (row.agent_id.trim() !== params.agentId.trim()) {
    throw new ProposalError(
      "agentId does not match the authenticated API key.",
      "agent_mismatch"
    );
  }

  return row;
}

export async function getActiveExecutionTokenForProposal(
  supabase: SupabaseClient,
  params: { proposalId: string; organizationId: string }
): Promise<ExecutionTokenRow | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("execution_tokens")
    .select(TOKEN_COLUMNS)
    .eq("action_proposal_id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .eq("status", "active")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data as ExecutionTokenRow | null) ?? null;
}

export async function insertExecutionToken(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actionProposalId: string;
    tokenHash: string;
    tokenPrefix: string;
    expiresAt: string;
  }
): Promise<ExecutionTokenRow> {
  const { data, error } = await supabase
    .from("execution_tokens")
    .insert({
      organization_id: params.organizationId,
      action_proposal_id: params.actionProposalId,
      token_hash: params.tokenHash,
      token_prefix: params.tokenPrefix,
      status: "active",
      expires_at: params.expiresAt,
    })
    .select(TOKEN_COLUMNS)
    .single();

  if (error || !data) {
    throw new ProposalError(error?.message ?? "Failed to store execution token.");
  }

  return data as ExecutionTokenRow;
}

export async function getExecutionTokenByHash(
  supabase: SupabaseClient,
  tokenHash: string
): Promise<ExecutionTokenRow | null> {
  const { data, error } = await supabase
    .from("execution_tokens")
    .select(TOKEN_COLUMNS)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data as ExecutionTokenRow | null) ?? null;
}

/**
 * Atomically marks a token as used. Returns null when already consumed,
 * expired, or mismatched — enabling replay detection.
 */
export async function consumeExecutionTokenAtomically(
  supabase: SupabaseClient,
  params: {
    tokenHash: string;
    proposalId: string;
    organizationId: string;
    consumedAt: string;
  }
): Promise<ExecutionTokenRow | null> {
  const { data, error } = await supabase
    .from("execution_tokens")
    .update({
      status: "used",
      used_at: params.consumedAt,
    })
    .eq("token_hash", params.tokenHash)
    .eq("action_proposal_id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .eq("status", "active")
    .gt("expires_at", params.consumedAt)
    .select(TOKEN_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data as ExecutionTokenRow | null) ?? null;
}

export async function revokeActiveTokensForProposal(
  supabase: SupabaseClient,
  params: { proposalId: string; organizationId: string; revokedAt: string }
): Promise<void> {
  const { error } = await supabase
    .from("execution_tokens")
    .update({
      status: "revoked",
      revoked_at: params.revokedAt,
    })
    .eq("action_proposal_id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .eq("status", "active");

  if (error) {
    throw new ProposalError(error.message);
  }
}

export async function insertTokenAuditEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actionProposalId: string;
    eventType: "token_issued" | "token_consumed" | "token_revoked";
    agentId: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    organization_id: params.organizationId,
    action_proposal_id: params.actionProposalId,
    event_type: params.eventType,
    agent_id: params.agentId,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new ProposalError(error.message);
  }
}
