import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import {
  GROK_RISK_SERVICE_UNAVAILABLE,
  GrokRiskScoringError,
  decisionFromRiskScore,
  mergePolicyDecisions,
  riskScoreToRiskLevel,
  riskScoreToStoredInteger,
  scoreActionRiskWithGrok,
  toPolicyDecision,
  type GrokActionRiskResult,
} from "@/lib/xai/score-action-risk";
import { GrokServiceError } from "@/lib/xai/errors";

export type ProposedActionRiskOutcome =
  | { ok: true; data: GrokActionRiskResult }
  | { ok: false; error: string };

/**
 * Scores a proposed agent action with Grok (xAI).
 * Used by POST /api/v1/actions/propose during policy evaluation.
 */
export async function scoreProposedActionRisk(params: {
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
}): Promise<ProposedActionRiskOutcome> {
  try {
    const data = await scoreActionRiskWithGrok({
      toolName: params.toolName,
      actionType: params.actionType,
      ...params.payload,
    });

    return { ok: true, data };
  } catch (err) {
    if (err instanceof GrokServiceError) {
      return { ok: false, error: GROK_RISK_SERVICE_UNAVAILABLE };
    }

    if (err instanceof GrokRiskScoringError) {
      return { ok: false, error: err.message };
    }

    const message = err instanceof Error ? err.message : "Risk scoring failed.";
    return { ok: false, error: message };
  }
}

export function applyGrokRiskToPolicyDecision(params: {
  deterministicDecision: PolicyDecisionOutcome;
  grokRisk: ProposedActionRiskOutcome;
}): {
  decision: PolicyDecisionOutcome;
  riskScore?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  reason?: string;
  model?: string;
} {
  if (!params.grokRisk.ok) {
    return { decision: params.deterministicDecision };
  }

  return {
    decision: mergePolicyDecisions(
      params.deterministicDecision,
      params.grokRisk.data.policyDecision
    ),
    riskScore: riskScoreToStoredInteger(params.grokRisk.data.risk_score),
    riskLevel: riskScoreToRiskLevel(params.grokRisk.data.risk_score),
    reason: params.grokRisk.data.reason,
    model: params.grokRisk.data.model,
  };
}

export {
  scoreActionRiskWithGrok,
  decisionFromRiskScore,
  toPolicyDecision,
  mergePolicyDecisions,
};
