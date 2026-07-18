import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";
import { recordAudit } from "@/lib/audit/logger";
import { extractRequestContext } from "@/lib/audit/context";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import {
  effectiveReviewDeadline,
  ensureReviewFreshOrProcessed,
  type ReviewTimeoutDeps,
} from "@/lib/gateway/review/timeout";
import {
  finalizeHumanProposalDecision,
  getActionProposalById,
  insertApprovalDecision,
  listReviewRequiredProposals,
  type ActionProposalRow,
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

export interface HumanDecisionDeps {
  ensureFresh: typeof ensureReviewFreshOrProcessed;
  finalizeDecision: typeof finalizeHumanProposalDecision;
  insertDecision: typeof insertApprovalDecision;
  recordRuntimeAudit: typeof recordRuntimeAuditEventAsync;
  recordRetrospectiveAudit: typeof recordAudit;
  listReviews: typeof listReviewRequiredProposals;
  getProposal: typeof getActionProposalById;
  reviewTimeoutDeps?: Partial<ReviewTimeoutDeps>;
}

const defaultHumanDecisionDeps: HumanDecisionDeps = {
  ensureFresh: ensureReviewFreshOrProcessed,
  finalizeDecision: finalizeHumanProposalDecision,
  insertDecision: insertApprovalDecision,
  recordRuntimeAudit: recordRuntimeAuditEventAsync,
  recordRetrospectiveAudit: recordAudit,
  listReviews: listReviewRequiredProposals,
  getProposal: getActionProposalById,
};

export async function listGatewayPendingApprovals(
  supabase: SupabaseClient,
  organizationId: string,
  deps: Pick<HumanDecisionDeps, "listReviews" | "ensureFresh"> = defaultHumanDecisionDeps
): Promise<PendingApproval[]> {
  const rows = await deps.listReviews(supabase, organizationId);
  const refreshed: ActionProposalRow[] = [];

  for (const row of rows) {
    const current = await deps.ensureFresh(supabase, {
      proposalId: row.id,
      organizationId,
    });
    if (current?.status === "review_required") {
      refreshed.push(current);
    }
  }

  return refreshed.map(mapReviewProposalToPendingApproval);
}

export async function decideGatewayProposalReview(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
  params: DecideGatewayProposalParams,
  deps: HumanDecisionDeps = defaultHumanDecisionDeps
): Promise<DecideGatewayProposalResult> {
  const existing = await deps.ensureFresh(
    writeClient,
    {
      proposalId: params.proposalId,
      organizationId: params.organizationId,
    },
    { deps: deps.reviewTimeoutDeps }
  );

  if (!existing) {
    throw new ProposalError("Action proposal not found.");
  }

  if (existing.status === "rejected") {
    throw new ProposalError("Proposal was automatically denied after the review deadline expired.");
  }

  if (existing.status !== "review_required") {
    throw new ProposalError(`Proposal is already ${existing.status}.`);
  }

  const reviewDeadline = effectiveReviewDeadline(existing);
  const decidedAt = new Date().toISOString();

  if (new Date(reviewDeadline) <= new Date(decidedAt)) {
    throw new ProposalError("Review deadline has expired for this proposal.");
  }

  const proposalStatus = params.decision;
  const auditCtx = extractRequestContext(params.request);

  const updated = await deps.finalizeDecision(writeClient, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
    actionHash: existing.action_hash,
    status: proposalStatus,
    decidedAt,
    reviewExpiresAt: reviewDeadline,
  });

  await deps.insertDecision(writeClient, {
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
      reviewExpiresAt: reviewDeadline,
    },
  });

  deps.recordRuntimeAudit(writeClient, {
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
      reviewExpiresAt: reviewDeadline,
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent,
  });

  await deps.recordRetrospectiveAudit(readClient, {
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
      reviewExpiresAt: reviewDeadline,
    },
  });

  return {
    proposalId: updated.id,
    status: params.decision,
    actionHash: updated.action_hash,
    decidedAt,
  };
}
