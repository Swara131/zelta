import type { DecisionAgentConfig, DecisionOutcome, DecisionRiskLevel } from "./types";

export interface DecisionEvaluationResult {
  outcome: DecisionOutcome;
  matchedRuleId: string | null;
  reasoning: string;
  usedAiReasoning: boolean;
  riskLevel: DecisionRiskLevel;
}

export function inferDecisionRiskLevel(
  input: Record<string, unknown>,
  outcome: DecisionOutcome
): DecisionRiskLevel {
  const riskScore = Number(input.risk_score ?? input.risk ?? 0);
  if (outcome === "block" || riskScore >= 0.75) return "high";
  if (outcome === "review" || riskScore >= 0.4) return "medium";
  return "low";
}

/** Deterministic rule evaluation — no fake results. */
export function evaluateDecision(
  config: DecisionAgentConfig,
  input: Record<string, unknown>,
  options?: { threshold?: number }
): DecisionEvaluationResult {
  const threshold = options?.threshold ?? 5000;
  const refundAmount = Number(input.refund_amount ?? input.amount ?? 0);
  const customerEligible = Boolean(input.customer_eligible ?? input.eligible ?? false);
  const riskScore = Number(input.risk_score ?? input.risk ?? 0);
  const confidence = Number(input.confidence ?? 0.5);
  const policyMatch = Boolean(input.policy_match ?? true);

  for (const rule of config.rules) {
    if (rule.expression.includes("refund_amount") && rule.outcome === "allow") {
      if (
        refundAmount > 0 &&
        refundAmount <= threshold &&
        customerEligible &&
        riskScore < 0.5
      ) {
        const outcome = "allow" as const;
        return {
          outcome,
          matchedRuleId: rule.id,
          reasoning: `Refund amount ₹${refundAmount.toLocaleString("en-IN")} is within threshold and customer is eligible with low risk.`,
          usedAiReasoning: false,
          riskLevel: inferDecisionRiskLevel(input, outcome),
        };
      }
    }

    if (rule.expression === "otherwise" && refundAmount > threshold) {
      const outcome = "review" as const;
      return {
        outcome,
        matchedRuleId: rule.id,
        reasoning: `Refund amount exceeds configured threshold of ₹${threshold.toLocaleString("en-IN")}.`,
        usedAiReasoning: false,
        riskLevel: inferDecisionRiskLevel(input, outcome),
      };
    }

    if (rule.expression.includes("confidence") && rule.outcome === "allow") {
      if (confidence >= 0.7 && policyMatch) {
        const outcome = "allow" as const;
        return {
          outcome,
          matchedRuleId: rule.id,
          reasoning: "Policy match with sufficient confidence.",
          usedAiReasoning: config.aiReasoningEnabled,
          riskLevel: inferDecisionRiskLevel(input, outcome),
        };
      }
    }

    if (rule.expression.includes("confidence") && rule.outcome === "review") {
      if (confidence < 0.7) {
        const outcome = "review" as const;
        return {
          outcome,
          matchedRuleId: rule.id,
          reasoning: "Confidence below threshold — human review required.",
          usedAiReasoning: config.aiReasoningEnabled,
          riskLevel: inferDecisionRiskLevel(input, outcome),
        };
      }
    }
  }

  if (riskScore >= 0.75) {
    const outcome = "block" as const;
    return {
      outcome,
      matchedRuleId: null,
      reasoning: "Risk score is too high for automatic action.",
      usedAiReasoning: false,
      riskLevel: inferDecisionRiskLevel(input, outcome),
    };
  }

  const outcome = "review" as const;
  return {
    outcome,
    matchedRuleId: null,
    reasoning: "No deterministic rule matched. Defaulting to review.",
    usedAiReasoning: config.aiReasoningEnabled,
    riskLevel: inferDecisionRiskLevel(input, outcome),
  };
}
