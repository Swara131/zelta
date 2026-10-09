import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import type { MatchedPolicyReason, PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import {
  buildRiskContext,
  extractDeterministicRiskSignals,
  type DeterministicRiskSignal,
} from "@/lib/gateway/risk/signals";
import type { ShadowRiskSignalSeverity } from "@/lib/gateway/risk/assessment";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  buildDemoActionPayload,
  type DemoActionId,
} from "./demo-action-catalog";

export type SafetyCheckDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface SafetyCheckRequest {
  agentId: string;
  agentName: string;
  actionId: DemoActionId;
  customerId: string;
  reason: string;
  amountInr?: number | null;
}

export interface SafetyCheckResult {
  decision: SafetyCheckDecision;
  headline: "ALLOWED AUTOMATICALLY" | "APPROVAL REQUIRED" | "BLOCKED";
  summary: string;
  policyDecision: string;
  riskLevel: RiskSeverity;
  riskScore: number;
  reason: string;
  requiredApproval: boolean;
  agentName: string;
  actionLabel: string;
  amountDisplay: string | null;
  customerId: string;
  description: string | null;
  timestamp: string;
  matchedPolicies: MatchedPolicyReason[];
  riskSignals: DeterministicRiskSignal[];
  demo: true;
}

const DECISION_HEADLINE: Record<
  SafetyCheckDecision,
  SafetyCheckResult["headline"]
> = {
  ALLOW: "ALLOWED AUTOMATICALLY",
  REVIEW: "APPROVAL REQUIRED",
  BLOCK: "BLOCKED",
};

const DECISION_SUMMARY: Record<SafetyCheckDecision, string> = {
  ALLOW: "This action is safe according to the current protection rules.",
  REVIEW: "Wave paused this action because it requires human approval.",
  BLOCK: "Wave stopped this action because it violates the protection rules.",
};

function toSafetyDecision(decision: PolicyDecisionOutcome): SafetyCheckDecision {
  return decision;
}

function deriveRiskLevel(
  signals: DeterministicRiskSignal[],
  decision: SafetyCheckDecision
): RiskSeverity {
  if (decision === "BLOCK") return "critical";

  const rank: Record<ShadowRiskSignalSeverity, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  let max: ShadowRiskSignalSeverity = "low";
  for (const signal of signals) {
    if (rank[signal.severity] > rank[max]) {
      max = signal.severity;
    }
  }

  if (decision === "REVIEW" && max === "low") {
    return "medium";
  }

  return max;
}

function deriveRiskScore(
  signals: DeterministicRiskSignal[],
  decision: SafetyCheckDecision
): number {
  const weights: Record<ShadowRiskSignalSeverity, number> = {
    high: 78,
    medium: 52,
    low: 24,
  };

  let score = 20;
  for (const signal of signals) {
    score = Math.max(score, weights[signal.severity]);
  }

  if (decision === "REVIEW") {
    score = Math.max(score, 65);
  }
  if (decision === "BLOCK") {
    score = Math.max(score, 92);
  }

  return Math.min(score, 100);
}

function buildHumanReason(
  decision: SafetyCheckDecision,
  matchedPolicies: MatchedPolicyReason[],
  actionLabel: string,
  amountDisplay: string | null
): string {
  const primary = matchedPolicies[0];

  if (decision === "BLOCK" && primary) {
    return primary.reason;
  }

  if (decision === "ALLOW" && primary) {
    if (primary.policyId === "demo-refund-allow-small" && amountDisplay) {
      return `Refund of ${amountDisplay} is within the automatic approval limit of ₹5,000.`;
    }
    return primary.reason;
  }

  if (decision === "REVIEW") {
    if (primary?.policyId === "demo-refund-review-large" && amountDisplay) {
      return `Refund exceeds the automatic approval limit of ₹5,000.`;
    }
    if (primary?.policyId === "demo-export-review-large") {
      return primary.reason;
    }
    if (primary) {
      return primary.reason;
    }
    return `${actionLabel} does not match an automatic allow rule, so Wave requires a human decision.`;
  }

  return `${actionLabel} was evaluated against your protection rules.`;
}

/** Runs deterministic policy + risk analysis without persisting or executing anything. */
export function evaluateSafetyCheck(input: SafetyCheckRequest): SafetyCheckResult {
  const built = buildDemoActionPayload(input.actionId, {
    customerId: input.customerId,
    reason: input.reason,
    amountInr: input.amountInr,
  });

  const evaluation = evaluatePolicy({
    toolName: built.toolName,
    actionType: built.actionType,
    payload: built.payload,
  });

  const decision = toSafetyDecision(evaluation.decision);
  const riskContext = buildRiskContext({
    agentId: input.agentId,
    toolName: built.toolName,
    actionType: built.actionType,
    payload: built.payload,
  });
  const riskSignals = extractDeterministicRiskSignals(riskContext);
  const riskLevel = deriveRiskLevel(riskSignals, decision);
  const riskScore = deriveRiskScore(riskSignals, decision);

  const reason = buildHumanReason(
    decision,
    evaluation.matchedPolicies,
    built.actionLabel,
    built.amountDisplay
  );

  return {
    decision,
    headline: DECISION_HEADLINE[decision],
    summary: DECISION_SUMMARY[decision],
    policyDecision: decision === "ALLOW" ? "ALLOW" : decision,
    riskLevel,
    riskScore,
    reason,
    requiredApproval: decision === "REVIEW",
    agentName: input.agentName,
    actionLabel: built.actionLabel,
    amountDisplay: built.amountDisplay,
    customerId: input.customerId.trim() || "—",
    description: input.reason.trim() || null,
    timestamp: new Date().toISOString(),
    matchedPolicies: evaluation.matchedPolicies,
    riskSignals,
    demo: true,
  };
}
