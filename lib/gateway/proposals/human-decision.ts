import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";
import { recordAudit } from "@/lib/audit/logger";
import { extractRequestContext } from "@/lib/audit/context";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import {
  finalizeHumanProposalDecision,
  getActionProposalById,
  insertApprovalDecision,
  listReviewRequiredProposals,
} from "./repository";
import { mapReviewProposalToPendingApproval } from "./review-mapper";
import type { PendingApproval } from "@/lib/approval-types";
import type { RiskSeverity } from "@/lib/risk-types";

export type HumanReviewDecision = "approved" | "rejected";

export interface DecideGatewayProposalParams {
  proposalId: string;
  organizationId: string;
  actorId: string;
  actorEmail: string;
  decision: HumanReviewDecision;
  note?: string;
  request?: Request;
}

export interface DecideGatewayProposalResult {
  proposalId: string;
  status: HumanReviewDecision;
  actionHash: string;
  decidedAt: string;
}

export async function listGatewayPendingApprovals(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PendingApproval[]> {
  const rows = await listReviewRequiredProposals(supabase, organizationId);
  return rows.map(mapReviewProposalToPendingApproval);
}

export async function decideGatewayProposalReview(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
  params: DecideGatewayProposalParams
): Promise<DecideGatewayProposalResult> {
  const existing = await getActionProposalById(readClient, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
  });

  if (!existing) {
    throw new ProposalError("Action proposal not found.");
  }

  if (existing.status !== "review_required") {
    throw new ProposalError(`Proposal is already ${existing.status}.`);
  }

  const decidedAt = new Date().toISOString();
  const proposalStatus = params.decision;
  const auditCtx = extractRequestContext(params.request);

  const updated = await finalizeHumanProposalDecision(writeClient, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
    actionHash: existing.action_hash,
    status: proposalStatus,
    decidedAt,
  });

  await insertApprovalDecision(writeClient, {
    organizationId: params.organizationId,
    actionProposalId: params.proposalId,
    decisionSource: "human",
    policyDecision: existing.policy_decision as "review" | null,
    proposalStatus,
    actorId: params.actorId,
    reason: params.note ?? null,
    metadata: {
      actionHash: existing.action_hash,
      reviewerEmail: params.actorEmail,
      toolName: existing.tool_name,
      actionType: existing.action_type,
      decidedAt,
    },
  });

  recordRuntimeAuditEventAsync(writeClient, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: params.decision === "approved" ? "approval.approved" : "approval.rejected",
    actorId: params.actorId,
    agentId: existing.agent_id,
    metadata: {
      actionHash: existing.action_hash,
      note: params.note ?? null,
      reviewerEmail: params.actorEmail,
      toolName: existing.tool_name,
      actionType: existing.action_type,
      riskLevel: existing.risk_level,
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent,
  });

  await recordAudit(readClient, {
    request: params.request,
    userId: params.actorId,
    organizationId: params.organizationId,
    action: params.decision === "approved" ? "approve" : "reject",
    entityType: "action_proposal",
    entityId: params.proposalId,
    riskSeverity: existing.risk_level as RiskSeverity,
    approvalStatus: proposalStatus,
    metadata: {
      description:
        params.decision === "approved"
          ? `Human approved gateway proposal ${existing.tool_name}`
          : `Human rejected gateway proposal ${existing.tool_name}`,
      actionHash: existing.action_hash,
      note: params.note,
      agentId: existing.agent_id,
    },
  });

  return {
    proposalId: updated.id,
    status: params.decision,
    actionHash: updated.action_hash,
    decidedAt,
  };
}
