import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import type { ExplainableRiskAssessment } from "./assessment";
import {
  getRiskEnforcementMode,
  getRiskFailsafeMode,
  getRiskHybridConfidenceThreshold,
  type RiskEnforcementMode,
  type RiskFailsafeMode,
} from "./config";
import { UNCERTAINTY_CONFIDENCE_THRESHOLD } from "./evaluation";

export type RiskAssessmentAvailability =
  | "completed"
  | "failed"
  | "pending"
  | "unavailable";

export interface RiskAssessmentInput {
  status: RiskAssessmentAvailability;
  assessment?: ExplainableRiskAssessment;
  failureCode?: string;
}

export interface StoredDecisionComposition {
  deterministicDecision: PolicyDecisionOutcome;
  finalDecision: PolicyDecisionOutcome;
  riskRecommendedDecision: "allow" | "review" | null;
  escalated: boolean;
  escalationReason: string | null;
  enforcementMode: RiskEnforcementMode;
  failsafeMode: RiskFailsafeMode;
  classifierVersion: string | null;
  actionHash: string;
  composedAt: string;
}

export interface DecisionCompositionResult {
  deterministicDecision: PolicyDecisionOutcome;
  finalDecision: PolicyDecisionOutcome;
  riskRecommendedDecision: "allow" | "review" | null;
  escalated: boolean;
  escalationReason: string | null;
  enforcementMode: RiskEnforcementMode;
  failsafeMode: RiskFailsafeMode;
  classifierVersion: string | null;
}

export interface ComposeGatewayDecisionParams {
  deterministicDecision: PolicyDecisionOutcome;
  riskAssessment: RiskAssessmentInput;
  actionHash: string;
  enforcementMode?: RiskEnforcementMode;
  failsafeMode?: RiskFailsafeMode;
  hybridConfidenceThreshold?: number;
  composedAt?: string;
}

function baseResult(
  params: ComposeGatewayDecisionParams,
  overrides: Partial<DecisionCompositionResult> = {}
): DecisionCompositionResult {
  return {
    deterministicDecision: params.deterministicDecision,
    finalDecision: params.deterministicDecision,
    riskRecommendedDecision: null,
    escalated: false,
    escalationReason: null,
    enforcementMode: params.enforcementMode ?? getRiskEnforcementMode(),
    failsafeMode: params.failsafeMode ?? getRiskFailsafeMode(),
    classifierVersion: null,
    ...overrides,
  };
}

function riskRecommendationFromAssessment(
  assessment: ExplainableRiskAssessment
): "allow" | "review" {
  return assessment.recommendedDecision;
}

function shouldEscalateAllowToReview(params: {
  assessment: ExplainableRiskAssessment;
}): { escalate: boolean; reason: string | null } {
  const { assessment } = params;

  if (assessment.riskLevel === "critical") {
    return { escalate: true, reason: "Risk level critical requires review." };
  }
  if (assessment.riskLevel === "high") {
    return { escalate: true, reason: "Risk level high requires review." };
  }
  if (assessment.riskLevel === "medium") {
    return { escalate: true, reason: "Risk level medium requires review by default." };
  }
  if (assessment.confidence < UNCERTAINTY_CONFIDENCE_THRESHOLD) {
    return { escalate: true, reason: "Low classifier confidence requires review." };
  }
  if (assessment.riskLevel === "low") {
    return { escalate: false, reason: null };
  }

  return { escalate: false, reason: null };
}

function shouldEscalateAllowToReviewHybrid(params: {
  assessment: ExplainableRiskAssessment;
  confidenceThreshold: number;
}): { escalate: boolean; reason: string | null } {
  const { assessment, confidenceThreshold } = params;

  if (assessment.riskLevel !== "high" && assessment.riskLevel !== "critical") {
    return { escalate: false, reason: null };
  }

  if (assessment.confidence < confidenceThreshold) {
    return { escalate: false, reason: null };
  }

  if (assessment.riskLevel === "critical") {
    return {
      escalate: true,
      reason: "Hybrid routing: critical risk with sufficient confidence requires review.",
    };
  }

  return {
    escalate: true,
    reason: "Hybrid routing: high risk with sufficient confidence requires review.",
  };
}

function composeAllowWithAssessment(
  params: ComposeGatewayDecisionParams,
  assessment: ExplainableRiskAssessment
): DecisionCompositionResult {
  const enforcementMode = params.enforcementMode ?? getRiskEnforcementMode();
  const riskRecommendedDecision = riskRecommendationFromAssessment(assessment);
  const classifierVersion = assessment.classifierVersion;

  if (enforcementMode === "shadow") {
    return baseResult(params, {
      finalDecision: "ALLOW",
      riskRecommendedDecision,
      classifierVersion,
    });
  }

  if (enforcementMode === "hybrid") {
    const confidenceThreshold =
      params.hybridConfidenceThreshold ?? getRiskHybridConfidenceThreshold();
    const { escalate, reason } = shouldEscalateAllowToReviewHybrid({
      assessment,
      confidenceThreshold,
    });

    if (escalate) {
      return baseResult(params, {
        finalDecision: "REVIEW",
        riskRecommendedDecision,
        escalated: true,
        escalationReason: reason,
        classifierVersion,
      });
    }

    return baseResult(params, {
      finalDecision: "ALLOW",
      riskRecommendedDecision,
      classifierVersion,
    });
  }

  const { escalate, reason } = shouldEscalateAllowToReview({ assessment });

  if (escalate) {
    return baseResult(params, {
      finalDecision: "REVIEW",
      riskRecommendedDecision,
      escalated: true,
      escalationReason: reason,
      classifierVersion,
    });
  }

  return baseResult(params, {
    finalDecision: "ALLOW",
    riskRecommendedDecision,
    classifierVersion,
  });
}

function composeAllowWithoutAssessment(
  params: ComposeGatewayDecisionParams
): DecisionCompositionResult {
  const enforcementMode = params.enforcementMode ?? getRiskEnforcementMode();
  const failsafeMode = params.failsafeMode ?? getRiskFailsafeMode();

  if (enforcementMode === "shadow" || enforcementMode === "hybrid") {
    return baseResult(params, { finalDecision: "ALLOW" });
  }

  if (failsafeMode === "review") {
    return baseResult(params, {
      finalDecision: "REVIEW",
      escalated: true,
      escalationReason: `Risk assessment ${params.riskAssessment.status}; fail-safe mode review.`,
    });
  }

  return baseResult(params, {
    finalDecision: "ALLOW",
    escalationReason: null,
  });
}

/**
 * Composes the effective gateway decision from deterministic policy and risk assessment.
 * Precedence: BLOCK > REVIEW > risk-evaluated ALLOW.
 */
export function composeGatewayDecision(
  params: ComposeGatewayDecisionParams
): DecisionCompositionResult {
  const deterministicDecision = params.deterministicDecision;

  if (deterministicDecision === "BLOCK") {
    return baseResult(params, { finalDecision: "BLOCK" });
  }

  if (deterministicDecision === "REVIEW") {
    return baseResult(params, { finalDecision: "REVIEW" });
  }

  if (params.riskAssessment.status === "completed" && params.riskAssessment.assessment) {
    return composeAllowWithAssessment(params, params.riskAssessment.assessment);
  }

  return composeAllowWithoutAssessment(params);
}

export function toStoredDecisionComposition(
  result: DecisionCompositionResult,
  actionHash: string,
  composedAt = new Date().toISOString()
): StoredDecisionComposition {
  return {
    deterministicDecision: result.deterministicDecision,
    finalDecision: result.finalDecision,
    riskRecommendedDecision: result.riskRecommendedDecision,
    escalated: result.escalated,
    escalationReason: result.escalationReason,
    enforcementMode: result.enforcementMode,
    failsafeMode: result.failsafeMode,
    classifierVersion: result.classifierVersion,
    actionHash,
    composedAt,
  };
}

export function toRiskAssessmentInput(params: {
  status: "completed" | "failed";
  assessment?: ExplainableRiskAssessment;
  failureCode?: string;
}): RiskAssessmentInput {
  if (params.status === "completed" && params.assessment) {
    return { status: "completed", assessment: params.assessment };
  }
  return {
    status: "failed",
    failureCode: params.failureCode ?? "unknown",
  };
}
