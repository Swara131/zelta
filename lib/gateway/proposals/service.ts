import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { ProposalError } from "@/lib/gateway/errors";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import { notifyGatewayReviewRequired } from "@/lib/gateway/notifications/review-email";
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
  resolveFinalDecision,
  safeEnrichProposalAction,
  type EnrichmentOutcome,
} from "./enrichment";
import { canonicalizeAction, computeActionHash } from "./canonicalize";
import {
  findActiveProposalByHash,
  insertActionProposal,
  insertApprovalDecision,
  mapProposalRow,
  updateActionProposalPolicyOutcome,
  type ActionProposalRow,
} from "./repository";
import type { ProposeActionInput, ProposeActionResponse } from "./types";

/** Default proposal TTL before automatic expiry (hours). */
export const PROPOSAL_TTL_HOURS = 24;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProposeActionDeps {
  findActiveByHash: typeof findActiveProposalByHash;
  insertProposal: typeof insertActionProposal;
  updatePolicyOutcome: typeof updateActionProposalPolicyOutcome;
  insertDecision: typeof insertApprovalDecision;
  evaluatePolicyRules: typeof evaluatePolicy;
  enrichProposal: typeof safeEnrichProposalAction;
}

const defaultDeps: ProposeActionDeps = {
  findActiveByHash: findActiveProposalByHash,
  insertProposal: insertActionProposal,
  updatePolicyOutcome: updateActionProposalPolicyOutcome,
  insertDecision: insertApprovalDecision,
  evaluatePolicyRules: evaluatePolicy,
  enrichProposal: safeEnrichProposalAction,
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
  },
  deps: ProposeActionDeps
): Promise<{ row: ActionProposalRow; evaluation: ReturnType<typeof evaluatePolicy> }> {
  const evaluation = deps.evaluatePolicyRules({
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
  });

  const finalDecision = resolveFinalDecision(evaluation.decision, { ok: false, error: "" });
  const decidedAt = new Date().toISOString();
  const status = decisionToProposalStatus(finalDecision);
  const dbDecision = policyDecisionToDb(finalDecision);

  const enrichment: EnrichmentOutcome = await deps.enrichProposal({
    agentId: params.agentId,
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
    policyDecision: finalDecision,
    matchedPolicies: evaluation.matchedPolicies,
  });

  const storedRiskReasons = buildStoredRiskReasons(
    evaluation.matchedPolicies,
    enrichment
  );

  const row = await deps.updatePolicyOutcome(supabase, {
    proposalId: params.proposalId,
    organizationId: params.organizationId,
    status,
    policyDecision: dbDecision,
    riskReasons: storedRiskReasons,
    decidedAt,
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

  if (status === "review_required") {
    void notifyGatewayReviewRequired(supabase, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      toolName: params.toolName,
      actionType: params.actionType,
      plainEnglishSummary:
        enrichment.ok
          ? enrichment.data.plainEnglishSummary
          : "Agent action requires human review before execution.",
      riskLevel: (enrichment.ok ? enrichment.data.riskLevel : row.risk_level) as RiskSeverity,
      riskScore: enrichment.ok ? enrichment.data.riskScore : row.risk_score,
    });
  }

  return { row, evaluation };
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

  const existing = await deps.findActiveByHash(supabase, {
    organizationId: auth.organizationId,
    actionHash,
  });

  if (existing) {
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
      },
      deps
    );

    return toProposeResponse(row);
  }

  const inserted = await deps.insertProposal(supabase, {
    organizationId: auth.organizationId,
    agentId: canonical.agentId,
    toolName: canonical.toolName,
    actionType: canonical.actionType,
    actionPayload: canonical.payload as Record<string, unknown>,
    actionHash,
    expiresAt: computeExpiresAt(),
    requestedByUserId: resolveRequestedByUserId(input.requestedBy),
    idempotencyKey: input.idempotencyKey ?? null,
  });

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
    },
    deps
  );

  return toProposeResponse(row);
}

export { canonicalizeAction, computeActionHash };
