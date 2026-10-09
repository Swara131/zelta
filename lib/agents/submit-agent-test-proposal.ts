import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import {
  decisionToProposalStatus,
  policyDecisionToDb,
  type PolicyDecisionOutcome,
} from "@/lib/gateway/policy/types";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import { buildStoredRiskReasons } from "@/lib/gateway/proposals/enrichment";
import {
  insertActionProposal,
  insertApprovalDecision,
  updateActionProposalPolicyOutcome,
  type ActionProposalRow,
} from "@/lib/gateway/proposals/repository";
import { PROPOSAL_TTL_HOURS } from "@/lib/gateway/proposals/service";
import {
  buildGatewayReviewNotificationParams,
  notifyGatewayReviewRequired,
} from "@/lib/gateway/notifications/review-notification";
import { computeReviewExpiresAt } from "@/lib/gateway/review/config";
import { recordReviewDeadlineSet } from "@/lib/gateway/review/timeout";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";
import type { AgentTestEvaluation } from "@/lib/agents/evaluate-agent-test";

export interface SubmitAgentTestProposalParams {
  organizationId: string;
  userId: string;
  agentId: string;
  evaluation: AgentTestEvaluation;
}

export interface SubmitAgentTestProposalResult {
  proposalId: string | null;
  notificationSent: boolean;
  persisted: boolean;
}

function computeExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + PROPOSAL_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

function buildPlainEnglishSummary(
  agentId: string,
  toolName: string,
  payload: Record<string, unknown>
): string {
  const agent = humanizeAgentLabel(agentId);
  const customerId =
    typeof payload.customerId === "string" ? payload.customerId.trim() : null;
  const subject =
    typeof payload.subject === "string" ? payload.subject.trim() : null;

  if (toolName.toLowerCase().includes("email")) {
    const parts = [`${agent} wants to send an email`];
    if (customerId) parts.push(`to customer ${customerId}`);
    if (subject) parts.push(`with subject "${subject}"`);
    return `${parts.join(" ")}.`;
  }

  if (toolName.toLowerCase().includes("refund")) {
    return `${agent} wants to issue a refund${customerId ? ` for customer ${customerId}` : ""}.`;
  }

  return `${agent} wants to run ${toolName.replace(/_/g, " ")}.`;
}

function policyEventForDecision(
  decision: PolicyDecisionOutcome
): "policy.allow" | "policy.review" | "policy.block" {
  switch (decision) {
    case "ALLOW":
      return "policy.allow";
    case "REVIEW":
      return "policy.review";
    case "BLOCK":
      return "policy.block";
  }
}

/**
 * Persists an agent test action as a gateway proposal when approval is required.
 * Sends review notification email and records runtime audit events.
 */
export async function submitAgentTestProposal(
  admin: SupabaseClient,
  params: SubmitAgentTestProposalParams
): Promise<SubmitAgentTestProposalResult> {
  if (params.evaluation.decision !== "REVIEW") {
    return { proposalId: null, notificationSent: false, persisted: false };
  }

  const storedPayload: Record<string, unknown> = {
    ...params.evaluation.payload,
    _zeltaTestRunAt: new Date().toISOString(),
  };

  const actionHash = computeActionHash({
    organizationId: params.organizationId,
    agentId: params.agentId,
    toolName: params.evaluation.toolName,
    actionType: params.evaluation.actionType,
    payload: storedPayload,
  });

  const expiresAt = computeExpiresAt();
  const decidedAt = new Date().toISOString();
  const reviewExpiresAt = computeReviewExpiresAt({
    reviewRequestedAt: new Date(decidedAt),
    proposalExpiresAt: expiresAt,
  });

  const policyEvaluation = evaluatePolicy({
    toolName: params.evaluation.toolName,
    actionType: params.evaluation.actionType,
    payload: params.evaluation.payload,
  });

  const storedRiskReasons = {
    ...buildStoredRiskReasons(policyEvaluation.matchedPolicies, {
      ok: false,
      error: "Dashboard test — AI enrichment skipped.",
    }),
    testReason: params.evaluation.reason,
  };

  const plainEnglishSummary = buildPlainEnglishSummary(
    params.agentId,
    params.evaluation.toolName,
    params.evaluation.payload
  );

  let row: ActionProposalRow;

  try {
    row = await insertActionProposal(admin, {
      organizationId: params.organizationId,
      agentId: params.agentId,
      toolName: params.evaluation.toolName,
      actionType: params.evaluation.actionType,
      actionPayload: storedPayload,
      actionHash,
      expiresAt,
      requestedByUserId: params.userId,
      idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
  } catch (err) {
    console.error("[agent-test] Failed to insert proposal:", err);
    return { proposalId: null, notificationSent: false, persisted: false };
  }

  recordRuntimeAuditEventAsync(admin, {
    organizationId: params.organizationId,
    proposalId: row.id,
    event: "proposal.created",
    agentId: params.agentId,
    metadata: {
      toolName: params.evaluation.toolName,
      actionType: params.evaluation.actionType,
      actionHash,
      source: "agent_test",
    },
  });

  const status = decisionToProposalStatus("REVIEW");
  const dbDecision = policyDecisionToDb("REVIEW");

  row = await updateActionProposalPolicyOutcome(admin, {
    proposalId: row.id,
    organizationId: params.organizationId,
    status,
    policyDecision: dbDecision,
    riskReasons: storedRiskReasons,
    decidedAt,
    reviewExpiresAt,
    plainEnglishSummary,
    riskLevel: params.evaluation.riskLevel,
    riskScore: params.evaluation.riskScore,
  });

  await insertApprovalDecision(admin, {
    organizationId: params.organizationId,
    actionProposalId: row.id,
    decisionSource: "policy",
    policyDecision: dbDecision,
    proposalStatus: status,
    reason: params.evaluation.reason,
    metadata: {
      matchedPolicies: policyEvaluation.matchedPolicies,
      source: "agent_test",
      riskScore: params.evaluation.riskScore,
      riskLevel: params.evaluation.riskLevel,
    },
  });

  recordRuntimeAuditEventAsync(admin, {
    organizationId: params.organizationId,
    proposalId: row.id,
    event: policyEventForDecision("REVIEW"),
    agentId: params.agentId,
    metadata: {
      toolName: params.evaluation.toolName,
      actionType: params.evaluation.actionType,
      matchedPolicies: policyEvaluation.matchedPolicies.map((p) => p.name),
      riskLevel: params.evaluation.riskLevel,
      riskScore: params.evaluation.riskScore,
      source: "agent_test",
    },
  });

  recordReviewDeadlineSet(admin, {
    organizationId: params.organizationId,
    proposalId: row.id,
    agentId: params.agentId,
    actionHash,
    reviewExpiresAt,
    decidedAt,
    toolName: params.evaluation.toolName,
    actionType: params.evaluation.actionType,
  });

  let notificationSent = false;
  const notificationParams = buildGatewayReviewNotificationParams(row, actionHash);
  if (notificationParams) {
    const notificationResult = await notifyGatewayReviewRequired(admin, notificationParams);
    notificationSent = notificationResult.sent > 0;
  }

  return {
    proposalId: row.id,
    notificationSent,
    persisted: true,
  };
}
