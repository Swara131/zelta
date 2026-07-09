import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalStatus, TimelineEvent } from "@/lib/approval-types";
import type { DetectedRisk } from "@/lib/risk-types";
import { recordAudit } from "@/lib/audit/logger";
import { ApprovalEngineError } from "./errors";
import {
  createApprovalFromRisk,
  getApprovalRequest,
  insertApprovalHistory,
  updateApprovalRequest,
} from "./repository";
import {
  computeSlaDeadline,
  getApprovalRule,
  getRequiredApprovals,
  isApprovalComplete,
  remainingApprovals,
  severityToPriority,
  shouldAutoApprove,
} from "./rules";
import { sendApprovalCreatedEmails, sendApprovalDecisionEmails } from "./notifications";

export interface GenerateApprovalsResult {
  created: number;
  autoApproved: number;
  pending: number;
  requestIds: string[];
}

/**
 * Materializes one approval_request per detected risk from a risk analysis run.
 * Applies tier rules: Safe auto-approves; Medium/High/Critical queue for human review.
 */
export async function generateApprovalsFromRiskAnalysis(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    requesterId: string;
    riskAnalysisId: string;
    risks: DetectedRisk[];
  }
): Promise<GenerateApprovalsResult> {
  const { organizationId, requesterId, riskAnalysisId, risks } = params;

  if (risks.length === 0) {
    return { created: 0, autoApproved: 0, pending: 0, requestIds: [] };
  }

  const submittedAt = new Date().toISOString();
  const result: GenerateApprovalsResult = {
    created: 0,
    autoApproved: 0,
    pending: 0,
    requestIds: [],
  };

  for (const risk of risks) {
    const rule = getApprovalRule(risk.severity);
    const requiredApprovals = getRequiredApprovals(risk.severity);
    const autoApprove = shouldAutoApprove(risk.severity);

    const row = await createApprovalFromRisk(supabase, {
      organizationId,
      requesterId,
      riskAnalysisId,
      risk,
      requiredApprovals,
      autoApprove,
      ruleLabel: rule.label,
      priority: severityToPriority(risk.severity),
      slaDeadline: computeSlaDeadline(risk.severity),
      submittedAt,
    });

    result.created += 1;
    result.requestIds.push(row.id);

    if (autoApprove) {
      result.autoApproved += 1;
    } else {
      result.pending += 1;
    }

    await sendApprovalCreatedEmails(supabase, row, autoApprove);

    await recordAudit(supabase, {
      userId: requesterId,
      organizationId,
      action: autoApprove ? "approve" : "create",
      entityType: "approval_request",
      entityId: row.id,
      riskSeverity: risk.severity,
      approvalStatus: autoApprove ? "approved" : "pending",
      metadata: {
        title: risk.title,
        description: autoApprove
          ? `Auto-approved safe action: "${risk.title}"`
          : `Approval requested for "${risk.title}"`,
        requiredApprovals,
        agentId: row.agent_id,
      },
    });
  }

  return result;
}

export type ApprovalDecision = Extract<
  ApprovalStatus,
  "approved" | "rejected" | "changes_requested" | "escalated"
>;

export interface DecideApprovalResult {
  requestId: string;
  status: ApprovalStatus;
  approvalsReceived: number;
  requiredApprovals: number;
  remaining: number;
  finalized: boolean;
}

/**
 * Records a human (or system) decision and applies multi-tier approval logic.
 * - Reject / changes_requested / escalated → immediately final
 * - Approve → increments count; final when threshold met
 */
export async function decideApproval(
  supabase: SupabaseClient,
  params: {
    requestId: string;
    actorId: string;
    decision: ApprovalDecision;
    note?: string;
  }
): Promise<DecideApprovalResult> {
  const request = await getApprovalRequest(supabase, params.requestId);

  if (!request) {
    throw new ApprovalEngineError("Approval request not found.");
  }

  if (request.status !== "pending") {
    throw new ApprovalEngineError(
      `Request is already ${request.status} and cannot be updated.`
    );
  }

  const historyAction = params.decision === "approved" ? "approved" : params.decision;

  await insertApprovalHistory(supabase, {
    organizationId: request.organization_id,
    approvalRequestId: request.id,
    actorId: params.actorId,
    action: historyAction,
    note: params.note ?? null,
  });

  const now = new Date().toISOString();

  if (params.decision === "rejected") {
    await updateApprovalRequest(supabase, request.id, {
      status: "rejected",
      resolved_at: now,
    });

    await sendApprovalDecisionEmails(supabase, request, {
      actorId: params.actorId,
      decision: "rejected",
      finalized: true,
      note: params.note,
    });

    return {
      requestId: request.id,
      status: "rejected",
      approvalsReceived: request.approvals_received,
      requiredApprovals: request.required_approvals,
      remaining: 0,
      finalized: true,
    };
  }

  if (params.decision === "changes_requested") {
    await updateApprovalRequest(supabase, request.id, {
      status: "changes_requested",
      resolved_at: now,
    });

    return {
      requestId: request.id,
      status: "changes_requested",
      approvalsReceived: request.approvals_received,
      requiredApprovals: request.required_approvals,
      remaining: 0,
      finalized: true,
    };
  }

  if (params.decision === "escalated") {
    const timeline: TimelineEvent[] = [...((request.timeline as TimelineEvent[]) ?? [])];
    timeline.push({
      id: `tl-${request.id}-escalated-${Date.now()}`,
      title: "Escalated",
      description: params.note ?? "Escalated to senior reviewer",
      timestamp: now,
      actor: "Reviewer",
      type: "escalated",
    });

    await updateApprovalRequest(supabase, request.id, {
      status: "escalated",
      resolved_at: now,
      timeline,
      priority: request.priority === "p1" ? "p1" : "p1",
    });

    return {
      requestId: request.id,
      status: "escalated",
      approvalsReceived: request.approvals_received,
      requiredApprovals: request.required_approvals,
      remaining: remainingApprovals(
        request.required_approvals,
        request.approvals_received
      ),
      finalized: true,
    };
  }

  const approvalsReceived = request.approvals_received + 1;
  const required = request.required_approvals;
  const complete = isApprovalComplete(required, approvalsReceived);

  if (complete) {
    await updateApprovalRequest(supabase, request.id, {
      status: "approved",
      approvals_received: approvalsReceived,
      resolved_at: now,
    });

    await sendApprovalDecisionEmails(supabase, request, {
      actorId: params.actorId,
      decision: "approved",
      finalized: true,
      note: params.note,
    });

    return {
      requestId: request.id,
      status: "approved",
      approvalsReceived,
      requiredApprovals: required,
      remaining: 0,
      finalized: true,
    };
  }

  const partialTimeline: TimelineEvent[] = [
    ...((request.timeline as TimelineEvent[]) ?? []),
  ];
  partialTimeline.push({
    id: `tl-${request.id}-partial-${approvalsReceived}`,
    title: `Approval ${approvalsReceived} of ${required}`,
    description: `${remainingApprovals(required, approvalsReceived)} more approval(s) required`,
    timestamp: now,
    actor: "Reviewer",
    type: "action",
  });

  await updateApprovalRequest(supabase, request.id, {
    approvals_received: approvalsReceived,
    timeline: partialTimeline,
  });

  return {
    requestId: request.id,
    status: "pending",
    approvalsReceived,
    requiredApprovals: required,
    remaining: remainingApprovals(required, approvalsReceived),
    finalized: false,
  };
}
