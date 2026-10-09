import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProtectionEvaluationResult } from "@/lib/agents/protection/types";
import {
  decisionToProposalStatus,
  policyDecisionToDb,
  type PolicyDecisionOutcome,
} from "@/lib/gateway/policy/types";
import { evaluateAction } from "@/lib/safety/gate";
import type { SafetyDecision } from "@/lib/safety/types";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import { buildStoredRiskReasons } from "@/lib/gateway/proposals/enrichment";
import {
  insertActionProposal,
  insertApprovalDecision,
  updateActionProposalPolicyOutcome,
} from "@/lib/gateway/proposals/repository";
import { PROPOSAL_TTL_HOURS } from "@/lib/gateway/proposals/service";
import {
  buildGatewayReviewNotificationParams,
  notifyGatewayReviewRequired,
} from "@/lib/gateway/notifications/review-notification";
import { computeReviewExpiresAt } from "@/lib/gateway/review/config";
import { recordReviewDeadlineSet } from "@/lib/gateway/review/timeout";
import { resolveActionType } from "../tools/definitions";
import type { ControlDecision, ControlEvaluationResult, LoadedAgent } from "../types";

export interface ControlLayerRequest {
  agent: LoadedAgent;
  userId: string;
  organizationId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  actionType?: string;
  runId?: string | null;
  source?: string;
}

function computeExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + PROPOSAL_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

function safetyDecisionToControl(decision: SafetyDecision): ControlDecision {
  if (decision === "REQUIRE_APPROVAL") return "REVIEW";
  return decision;
}

function safetyDecisionToPolicyOutcome(decision: SafetyDecision): PolicyDecisionOutcome {
  if (decision === "REQUIRE_APPROVAL") return "REVIEW";
  return decision;
}

function toProtectionShape(
  safety: ReturnType<typeof evaluateAction>,
  toolName: string,
  actionType: string
): ProtectionEvaluationResult {
  return {
    decision: safetyDecisionToPolicyOutcome(safety.decision),
    reason: safety.reason,
    why: safety.why,
    riskLevel: safety.riskLevel,
    riskScore: safety.riskScore,
    matchedPolicies: safety.matchedPolicies.map((policy) => ({
      policyId: policy.policyId,
      name: policy.name,
      decision: safetyDecisionToPolicyOutcome(policy.decision),
      reason: policy.reason,
    })),
    riskSignals: [],
    plainEnglishSummary: safety.plainEnglishSummary,
    actionDetails: {
      toolName,
      actionType,
    },
  };
}

/**
 * All tool requests MUST pass through Wave's control layer.
 * Execution is only permitted when decision === ALLOW.
 */
export async function evaluateToolThroughControlLayer(
  admin: SupabaseClient,
  request: ControlLayerRequest
): Promise<ControlEvaluationResult> {
  const actionType = resolveActionType(request.toolName, request.actionType);
  const payload = {
    ...request.toolInput,
    _zeltaRuntimeRunId: request.runId ?? null,
    _zeltaRuntimeUserId: request.userId,
    _zeltaBuilderAgentId: request.agent.record.id,
    _zeltaRuntimeSource: request.source ?? "agent_runtime",
  };

  const safety = evaluateAction({
    agent: request.agent,
    tool: request.toolName,
    action: actionType,
    parameters: payload,
    context: {
      runId: request.runId,
      source: request.source ?? "agent_runtime",
    },
  });

  const protection = toProtectionShape(safety, request.toolName, actionType);
  const decision = safetyDecisionToControl(safety.decision);
  const reason = protection.reason;
  const matchedPolicies = protection.matchedPolicies.map((policy) => ({
    name: policy.name,
    reason: policy.reason,
  }));

  if (decision === "ALLOW") {
    recordRuntimeAuditEventAsync(admin, {
      organizationId: request.organizationId,
      event: "policy.allow",
      agentId: request.agent.gatewayAgentId,
      metadata: {
        toolName: request.toolName,
        actionType,
        source: request.source ?? "agent_runtime",
        builderAgentId: request.agent.record.id,
        agentRunId: request.runId ?? null,
        riskLevel: protection.riskLevel,
        riskScore: protection.riskScore,
        policyId: safety.policyId,
        sanitizedParameters: safety.sanitizedParameters,
      },
    });

    return {
      decision,
      reason,
      why: protection.why,
      riskLevel: protection.riskLevel,
      riskScore: protection.riskScore,
      plainEnglishSummary: protection.plainEnglishSummary,
      proposalId: null,
      canExecute: safety.canExecute,
      matchedPolicies,
    };
  }

  const actionHash = computeActionHash({
    organizationId: request.organizationId,
    agentId: request.agent.gatewayAgentId,
    toolName: request.toolName,
    actionType,
    payload,
  });

  const expiresAt = computeExpiresAt();
  const decidedAt = new Date().toISOString();
  const reviewExpiresAt = computeReviewExpiresAt({
    reviewRequestedAt: new Date(decidedAt),
    proposalExpiresAt: expiresAt,
  });

  const row = await insertActionProposal(admin, {
    organizationId: request.organizationId,
    agentId: request.agent.gatewayAgentId,
    toolName: request.toolName,
    actionType,
    actionPayload: {
      ...payload,
      _zeltaBuilderAgentId: request.agent.record.id,
    },
    actionHash,
    expiresAt,
    requestedByUserId: request.userId,
    agentRunId: request.runId ?? null,
    idempotencyKey: `runtime-${request.runId ?? "run"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  const status = decisionToProposalStatus(safetyDecisionToPolicyOutcome(safety.decision));
  const dbDecision = policyDecisionToDb(safetyDecisionToPolicyOutcome(safety.decision));

  await updateActionProposalPolicyOutcome(admin, {
    proposalId: row.id,
    organizationId: request.organizationId,
    status,
    policyDecision: dbDecision,
    riskReasons: {
      ...buildStoredRiskReasons(protection.matchedPolicies, {
        ok: false,
        error: "Runtime protection layer — AI enrichment skipped.",
      }),
      protection: {
        why: protection.why,
        riskSignals: protection.riskSignals.map((signal) => signal.description),
        actionDetails: protection.actionDetails,
      },
    },
    decidedAt,
    reviewExpiresAt,
    plainEnglishSummary: protection.plainEnglishSummary,
    riskLevel: protection.riskLevel,
    riskScore: protection.riskScore,
  });

  await insertApprovalDecision(admin, {
    organizationId: request.organizationId,
    actionProposalId: row.id,
    decisionSource: "policy",
    policyDecision: dbDecision,
    proposalStatus: status,
    reason,
    metadata: {
      matchedPolicies: protection.matchedPolicies,
      riskSignals: protection.riskSignals,
      source: request.source ?? "agent_runtime",
      agentRunId: request.runId ?? null,
      why: protection.why,
    },
  });

  recordRuntimeAuditEventAsync(admin, {
    organizationId: request.organizationId,
    proposalId: row.id,
    event: decision === "BLOCK" ? "policy.block" : "policy.review",
    agentId: request.agent.gatewayAgentId,
    metadata: {
      toolName: request.toolName,
      actionType,
      source: request.source ?? "agent_runtime",
      builderAgentId: request.agent.record.id,
      agentRunId: request.runId ?? null,
      riskLevel: protection.riskLevel,
      riskScore: protection.riskScore,
      why: protection.why,
      policyId: safety.policyId,
      sanitizedParameters: safety.sanitizedParameters,
      safetyLayer: true,
    },
  });

  if (decision === "REVIEW") {
    recordReviewDeadlineSet(admin, {
      organizationId: request.organizationId,
      proposalId: row.id,
      agentId: request.agent.gatewayAgentId,
      actionHash,
      reviewExpiresAt,
      decidedAt,
      toolName: request.toolName,
      actionType,
    });

    const notificationParams = buildGatewayReviewNotificationParams(row, actionHash);
    if (notificationParams) {
      await notifyGatewayReviewRequired(admin, notificationParams);
    }
  }

  return {
    decision,
    reason,
    why: protection.why,
    riskLevel: protection.riskLevel,
    riskScore: protection.riskScore,
    plainEnglishSummary: protection.plainEnglishSummary,
    proposalId: row.id,
    canExecute: false,
    matchedPolicies,
  };
}
