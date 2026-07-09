import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";
import type { GatewayProposalStatus } from "./types";

export type ActionProposalRow = {
  id: string;
  organization_id: string;
  agent_id: string;
  tool_name: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  action_hash: string;
  plain_english_summary: string | null;
  risk_level: string;
  risk_score: number;
  risk_reasons: unknown;
  policy_decision: string | null;
  status: GatewayProposalStatus;
  requested_by: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  decided_at: string | null;
  executed_at: string | null;
};

const PROPOSAL_COLUMNS =
  "id, organization_id, agent_id, tool_name, action_type, action_payload, action_hash, plain_english_summary, risk_level, risk_score, risk_reasons, policy_decision, status, requested_by, idempotency_key, created_at, updated_at, expires_at, decided_at, executed_at";

const ACTIVE_STATUSES: GatewayProposalStatus[] = [
  "pending",
  "allowed",
  "review_required",
  "approved",
];

export async function findActiveProposalByHash(
  supabase: SupabaseClient,
  params: { organizationId: string; actionHash: string }
): Promise<ActionProposalRow | null> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("organization_id", params.organizationId)
    .eq("action_hash", params.actionHash)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data as ActionProposalRow | null) ?? null;
}

export async function insertActionProposal(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    agentId: string;
    toolName: string;
    actionType: string;
    actionPayload: Record<string, unknown>;
    actionHash: string;
    expiresAt: string;
    requestedByUserId?: string | null;
    idempotencyKey?: string | null;
  }
): Promise<ActionProposalRow> {
  const { data, error } = await supabase
    .from("action_proposals")
    .insert({
      organization_id: params.organizationId,
      agent_id: params.agentId,
      tool_name: params.toolName,
      action_type: params.actionType,
      action_payload: params.actionPayload,
      action_hash: params.actionHash,
      status: "pending",
      requested_by: params.requestedByUserId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      expires_at: params.expiresAt,
    })
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new ProposalError(error?.message ?? "Failed to store action proposal.");
  }

  return data as ActionProposalRow;
}

export async function updateActionProposalPolicyOutcome(
  supabase: SupabaseClient,
  params: {
    proposalId: string;
    organizationId: string;
    status: GatewayProposalStatus;
    policyDecision: "allow" | "review" | "block";
    riskReasons: unknown;
    decidedAt: string;
    plainEnglishSummary?: string | null;
    riskLevel?: string;
    riskScore?: number;
  }
): Promise<ActionProposalRow> {
  const { data, error } = await supabase
    .from("action_proposals")
    .update({
      status: params.status,
      policy_decision: params.policyDecision,
      risk_reasons: params.riskReasons,
      decided_at: params.decidedAt,
      plain_english_summary: params.plainEnglishSummary ?? null,
      risk_level: params.riskLevel,
      risk_score: params.riskScore,
    })
    .eq("id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error || !data) {
    throw new ProposalError(error?.message ?? "Failed to update action proposal.");
  }

  return data as ActionProposalRow;
}

export async function insertApprovalDecision(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actionProposalId: string;
    decisionSource: "policy" | "human" | "system";
    policyDecision?: "allow" | "review" | "block" | null;
    proposalStatus: GatewayProposalStatus;
    actorId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("approval_decisions").insert({
    organization_id: params.organizationId,
    action_proposal_id: params.actionProposalId,
    decision_source: params.decisionSource,
    policy_decision: params.policyDecision ?? null,
    proposal_status: params.proposalStatus,
    actor_id: params.actorId ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new ProposalError(error.message);
  }
}

export async function listReviewRequiredProposals(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ActionProposalRow[]> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "review_required")
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data ?? []) as ActionProposalRow[];
}

export async function getActionProposalById(
  supabase: SupabaseClient,
  params: { proposalId: string; organizationId: string }
): Promise<ActionProposalRow | null> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  return (data as ActionProposalRow | null) ?? null;
}

/**
 * Atomically updates a review_required proposal after human decision.
 * Binds to the exact action_hash to prevent stale decisions.
 */
export async function finalizeHumanProposalDecision(
  supabase: SupabaseClient,
  params: {
    proposalId: string;
    organizationId: string;
    actionHash: string;
    status: Extract<GatewayProposalStatus, "approved" | "rejected">;
    decidedAt: string;
  }
): Promise<ActionProposalRow> {
  const { data, error } = await supabase
    .from("action_proposals")
    .update({
      status: params.status,
      decided_at: params.decidedAt,
    })
    .eq("id", params.proposalId)
    .eq("organization_id", params.organizationId)
    .eq("status", "review_required")
    .eq("action_hash", params.actionHash)
    .select(PROPOSAL_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new ProposalError(error.message);
  }

  if (!data) {
    throw new ProposalError(
      "Proposal not found, already decided, or action hash mismatch."
    );
  }

  return data as ActionProposalRow;
}

export async function insertGatewayAuditEvent(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    actionProposalId: string;
    eventType:
      | "human_approved"
      | "human_rejected"
      | "review_requested"
      | "decision_recorded";
    actorId: string;
    agentId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    organization_id: params.organizationId,
    action_proposal_id: params.actionProposalId,
    event_type: params.eventType,
    actor_id: params.actorId,
    agent_id: params.agentId,
    metadata: params.metadata ?? {},
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    throw new ProposalError(error.message);
  }
}

export async function getGatewayReviewStats(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ pending: number; critical: number; p1: number }> {
  const { data, error } = await supabase
    .from("action_proposals")
    .select("risk_level")
    .eq("organization_id", organizationId)
    .eq("status", "review_required");

  if (error) {
    throw new ProposalError(error.message);
  }

  const rows = (data ?? []) as { risk_level: string }[];

  return {
    pending: rows.length,
    critical: rows.filter((row) => row.risk_level === "critical").length,
    p1: rows.filter((row) => ["critical", "high"].includes(row.risk_level)).length,
  };
}

export function mapProposalRow(row: ActionProposalRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    toolName: row.tool_name,
    actionType: row.action_type,
    actionPayload: row.action_payload,
    actionHash: row.action_hash,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
