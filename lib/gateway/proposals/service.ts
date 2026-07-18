import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { ProposalError } from "@/lib/gateway/errors";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import {
  buildGatewayReviewNotificationParams,
  notifyGatewayReviewRequired,
} from "@/lib/gateway/notifications/review-notification";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import {
  decisionToProposalStatus,
  policyDecisionFromDb,
  policyDecisionToDb,
} from "@/lib/gateway/policy/types";
import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  buildStoredRiskReasons,
  extractMatchedPoliciesFromRiskReasons,
  safeEnrichProposalAction,
  type EnrichmentOutcome,
} from "./enrichment";
import { canonicalizeAction, computeActionHash } from "./canonicalize";
import {
  findActiveProposalByHash,
  findProposalByIdempotencyKey,
  insertActionProposal,
  insertApprovalDecision,
  mapProposalRow,
  mergeActionProposalShadowRisk,
  updateActionProposalPolicyOutcome,
  type ActionProposalRow,
} from "./repository";
import { classifyRisk } from "@/lib/gateway/risk/classifier";
import {
  composeGatewayDecision,
  toStoredDecisionComposition,
} from "@/lib/gateway/risk/decision-composition";
import { runShadowRiskAnalysisSafely } from "@/lib/gateway/risk/shadow-integration";
import { computeReviewExpiresAt } from "@/lib/gateway/review/config";
import { recordReviewDeadlineSet } from "@/lib/gateway/review/timeout";
import type { ProposeActionInput, ProposeActionResponse } from "./types";

/** Default proposal TTL before automatic expiry (hours). */
export const PROPOSAL_TTL_HOURS = 24;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProposeActionDeps {
  findActiveByHash: typeof findActiveProposalByHash;
  findByIdempotencyKey: typeof findProposalByIdempotencyKey;
  insertProposal: typeof insertActionProposal;
  updatePolicyOutcome: typeof updateActionProposalPolicyOutcome;
  insertDecision: typeof insertApprovalDecision;
  evaluatePolicyRules: typeof evaluatePolicy;
  enrichProposal: typeof safeEnrichProposalAction;
  classifyShadowRisk: typeof classifyRisk;
  mergeProposalShadowRisk: typeof mergeActionProposalShadowRisk;
}

const defaultDeps: ProposeActionDeps = {
  findActiveByHash: findActiveProposalByHash,
  findByIdempotencyKey: findProposalByIdempotencyKey,
  insertProposal: insertActionProposal,
  updatePolicyOutcome: updateActionProposalPolicyOutcome,
  insertDecision: insertApprovalDecision,
  evaluatePolicyRules: evaluatePolicy,
  enrichProposal: safeEnrichProposalAction,
  classifyShadowRisk: classifyRisk,
  mergeProposalShadowRisk: mergeActionProposalShadowRisk,
};

function computeExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + PROPOSAL_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

function resolveRequestedByUserId(requestedBy?: string): string | null {
  if (!requestedBy?.trim()) {
    return null;
  }

  const value = requestedBy.trim();
  return UUID_PATTERN.test(value) ? value : null;
}

function toProposeResponse(row: ActionProposalRow): ProposeActionResponse {
  const matchedPolicies = extractMatchedPoliciesFromRiskReasons(row.risk_reasons);
  const decision =
    policyDecisionFromDb(row.policy_decision) ??
    (matchedPolicies.length > 0
      ? matchedPolicies[0]!.decision
      : row.status === "allowed"
        ? "ALLOW"
        : row.status === "blocked"
          ? "BLOCK"
          : "REVIEW");

  return {
    proposalId: row.id,
    status: row.status,
    actionHash: row.action_hash,
    decision,
    matchedPolicies,
  };
}

export function assertAgentMatchesAuth(
  auth: AgentAuthContext,
  agentId: string
): void {
  if (auth.agentId.trim() !== agentId.trim()) {
    throw new ProposalError(
      "agentId does not match the authenticated API key.",
      "agent_mismatch"
    );
  }
}

function policyDecisionToRuntimeEvent(
  decision: PolicyDecisionOutcome
): "policy.allow" | "policy.review" | "policy.block" {
  switch (decision) {
    case "ALLOW":
      return "policy.allow";
    case "REVIEW":
      return "policy.review";
    case "BLOCK":
      return "policy.block";
    default:
      return "policy.review";
  }
}

async function applyPolicyDecision(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    agentId: string;
    toolName: string;
    actionType: string;
    payload: Record<string, unknown>;
    actionHash: string;
    proposalExpiresAt: string;
  },
  deps: ProposeActionDeps
): Promise<{ row: ActionProposalRow; evaluation: ReturnType<typeof evaluatePolicy> }> {
  const evaluation = deps.evaluatePolicyRules({
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
  });

  const deterministicDecision = evaluation.decision;

  const enrichment: EnrichmentOutcome = await deps.enrichProposal({
    agentId: params.agentId,
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
    policyDecision: deterministicDecision,
    matchedPolicies: evaluation.matchedPolicies,
  });

  const riskAssessment = await runShadowRiskAnalysisSafely(
    supabase,
    {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      actionHash: params.actionHash,
      agentId: params.agentId,
      toolName: params.toolName,
      actionType: params.actionType,
      payload: params.payload,
      policyDecision: deterministicDecision,
      matchedPolicyNames: evaluation.matchedPolicies.map((policy) => policy.name),
    },
    {
      classifyRisk: deps.classifyShadowRisk,
      mergeShadowRisk: deps.mergeProposalShadowRisk,
      recordAudit: recordRuntimeAuditEventAsync,
    }
  );

  const composition = composeGatewayDecision({
    deterministicDecision,
    riskAssessment,
    actionHash: params.actionHash,
  });

  const finalDecision = composition.finalDecision;
  const decidedAt = new Date().toISOString();
  const status = decisionToProposalStatus(finalDecision);
  const dbDecision = policyDecisionToDb(finalDecision);
  const reviewExpiresAt =
    status === "review_required"
      ? computeReviewExpiresAt({
          reviewRequestedAt: new Date(decidedAt),
          proposalExpiresAt: params.proposalExpiresAt,
        })
      : null;

  const storedRiskReasons = {
    ...buildStoredRiskReasons(evaluation.matchedPolicies, enrichment),
    decisionComposition: toStoredDecisionComposition(composition, params.actionHash, decidedAt),
  };

  const row = await deps.updatePolicyOutcome(supabase, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
    status,
    policyDecision: dbDecision,
    riskReasons: storedRiskReasons,
    decidedAt,
    reviewExpiresAt,
    plainEnglishSummary: enrichment.ok ? enrichment.data.plainEnglishSummary : null,
    riskLevel: enrichment.ok ? enrichment.data.riskLevel : undefined,
    riskScore: enrichment.ok ? enrichment.data.riskScore : undefined,
  });

  await deps.insertDecision(supabase, {
    organizationId: params.organizationId,
    actionProposalId: params.proposalId,
    decisionSource: "policy",
    policyDecision: dbDecision,
    proposalStatus: status,
    reason: evaluation.matchedPolicies.map((policy) => policy.name).join("; ") || null,
    metadata: {
      matchedPolicies: evaluation.matchedPolicies,
      deterministicDecision: composition.deterministicDecision,
      aiEnrichment: enrichment.ok
        ? {
            riskScore: enrichment.data.riskScore,
            riskLevel: enrichment.data.riskLevel,
            model: enrichment.data.model,
          }
        : { failure: storedRiskReasons.ai?.failure ?? null },
    },
  });

  recordRuntimeAuditEventAsync(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "decision.composed",
    agentId: params.agentId,
    metadata: {
      actionHash: params.actionHash,
      deterministicDecision: composition.deterministicDecision,
      finalDecision: composition.finalDecision,
      riskRecommendedDecision: composition.riskRecommendedDecision,
      escalated: composition.escalated,
      escalationReason: composition.escalationReason,
      enforcementMode: composition.enforcementMode,
      failsafeMode: composition.failsafeMode,
      classifierVersion: composition.classifierVersion,
    },
  });

  recordRuntimeAuditEventAsync(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: policyDecisionToRuntimeEvent(finalDecision),
    agentId: params.agentId,
    metadata: {
      toolName: params.toolName,
      actionType: params.actionType,
      matchedPolicies: evaluation.matchedPolicies.map((policy) => policy.name),
      riskLevel: enrichment.ok ? enrichment.data.riskLevel : row.risk_level,
      riskScore: enrichment.ok ? enrichment.data.riskScore : row.risk_score,
    },
  });

  if (enrichment.ok) {
    recordRuntimeAuditEventAsync(supabase, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      event: "ai.risk_analyzed",
      agentId: params.agentId,
      metadata: {
        toolName: params.toolName,
        actionType: params.actionType,
        riskLevel: enrichment.data.riskLevel,
        riskScore: enrichment.data.riskScore,
        model: enrichment.data.model,
      },
    });
  } else {
    recordRuntimeAuditEventAsync(supabase, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      event: "ai.risk_failed",
      agentId: params.agentId,
      metadata: {
        toolName: params.toolName,
        actionType: params.actionType,
        reason: enrichment.error,
      },
    });
  }

  if (status === "review_required" && reviewExpiresAt) {
    recordReviewDeadlineSet(supabase, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      actionHash: params.actionHash,
      reviewExpiresAt,
      decidedAt,
      toolName: params.toolName,
      actionType: params.actionType,
    });
  }

  if (row.status === "review_required") {
    const notificationParams = buildGatewayReviewNotificationParams(row, params.actionHash);
    if (notificationParams) {
      void notifyGatewayReviewRequired(supabase, notificationParams);
    }
  }

  return { row, evaluation };
}

function normalizeIdempotencyKey(idempotencyKey?: string): string | null {
  const trimmed = idempotencyKey?.trim();
  return trimmed ? trimmed : null;
}

function assertIdempotencyActionMatch(
  existing: ActionProposalRow,
  actionHash: string
): void {
  if (existing.action_hash !== actionHash) {
    throw new ProposalError(
      "Idempotency key was already used with a different action.",
      "idempotency_conflict"
    );
  }
}

async function resolveExistingProposalResponse(
  supabase: SupabaseClient,
  existing: ActionProposalRow,
  actionHash: string,
  deps: ProposeActionDeps
): Promise<ProposeActionResponse> {
  assertIdempotencyActionMatch(existing, actionHash);

  if (existing.policy_decision) {
    return toProposeResponse(existing);
  }

  const { row } = await applyPolicyDecision(
    supabase,
    {
      organizationId: existing.organization_id,
      proposalId: existing.id,
      agentId: existing.agent_id,
      toolName: existing.tool_name,
      actionType: existing.action_type,
      payload: existing.action_payload,
      actionHash,
      proposalExpiresAt: existing.expires_at,
    },
    deps
  );

  return toProposeResponse(row);
}

async function resolveExistingProposalByHash(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  existing: ActionProposalRow,
  deps: ProposeActionDeps
): Promise<ProposeActionResponse> {
  if (existing.policy_decision) {
    return toProposeResponse(existing);
  }

  const { row } = await applyPolicyDecision(
    supabase,
    {
      organizationId: auth.organizationId,
      proposalId: existing.id,
      agentId: existing.agent_id,
      toolName: existing.tool_name,
      actionType: existing.action_type,
      payload: existing.action_payload,
      actionHash: existing.action_hash,
      proposalExpiresAt: existing.expires_at,
    },
    deps
  );

  return toProposeResponse(row);
}

/**
 * Stores a pre-execution action proposal, evaluates deterministic policy,
 * enriches with advisory Groq analysis, and persists the outcome.
 */
export async function proposeAction(
  supabase: SupabaseClient,
  auth: AgentAuthContext,
  input: ProposeActionInput,
  deps: ProposeActionDeps = defaultDeps
): Promise<ProposeActionResponse> {
  assertAgentMatchesAuth(auth, input.agentId);

  const canonical = canonicalizeAction({
    organizationId: auth.organizationId,
    agentId: input.agentId,
    toolName: input.toolName,
    actionType: input.actionType,
    payload: input.payload,
  });

  const actionHash = computeActionHash({
    organizationId: auth.organizationId,
    agentId: input.agentId,
    toolName: input.toolName,
    actionType: input.actionType,
    payload: input.payload,
  });

  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey) {
    const existingByKey = await deps.findByIdempotencyKey(supabase, {
      organizationId: auth.organizationId,
      agentId: input.agentId,
      idempotencyKey,
    });

    if (existingByKey) {
      return resolveExistingProposalResponse(
        supabase,
        existingByKey,
        actionHash,
        deps
      );
    }
  }

  const existing = await deps.findActiveByHash(supabase, {
    organizationId: auth.organizationId,
    actionHash,
  });

  if (existing) {
    return resolveExistingProposalByHash(supabase, auth, existing, deps);
  }

  let inserted: ActionProposalRow;

  try {
    inserted = await deps.insertProposal(supabase, {
      organizationId: auth.organizationId,
      agentId: canonical.agentId,
      toolName: canonical.toolName,
      actionType: canonical.actionType,
      actionPayload: canonical.payload as Record<string, unknown>,
      actionHash,
      expiresAt: computeExpiresAt(),
      requestedByUserId: resolveRequestedByUserId(input.requestedBy),
      idempotencyKey,
    });
  } catch (err) {
    if (
      idempotencyKey &&
      err instanceof ProposalError &&
      err.pgCode === "23505"
    ) {
      const raced = await deps.findByIdempotencyKey(supabase, {
        organizationId: auth.organizationId,
        agentId: input.agentId,
        idempotencyKey,
      });

      if (raced) {
        return resolveExistingProposalResponse(supabase, raced, actionHash, deps);
      }
    }

    throw err;
  }

  recordRuntimeAuditEventAsync(supabase, {
    organizationId: auth.organizationId,
    proposalId: inserted.id,
    event: "proposal.created",
    agentId: canonical.agentId,
    metadata: {
      toolName: canonical.toolName,
      actionType: canonical.actionType,
      actionHash,
    },
  });

  const { row } = await applyPolicyDecision(
    supabase,
    {
      organizationId: auth.organizationId,
      proposalId: inserted.id,
      agentId: canonical.agentId,
      toolName: canonical.toolName,
      actionType: canonical.actionType,
      payload: canonical.payload as Record<string, unknown>,
      actionHash,
      proposalExpiresAt: inserted.expires_at,
    },
    deps
  );

  return toProposeResponse(row);
}

export { canonicalizeAction, computeActionHash };
