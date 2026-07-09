/** Final gateway policy outcomes (deterministic — not AI-generated). */
export type PolicyDecisionOutcome = "ALLOW" | "REVIEW" | "BLOCK";

export type DbPolicyDecision = "allow" | "review" | "block";

export interface PolicyConditions {
  /** Exact match or list of allowed tool names (case-sensitive). */
  toolName?: string | string[];
  /** Exact match or list of allowed action types. */
  actionType?: string | string[];
  /** Inclusive minimum amount (same unit as payload.amount). */
  amountMin?: number;
  /** Inclusive maximum amount. */
  amountMax?: number;
  /** ISO currency code, case-insensitive. */
  currency?: string;
  /** e.g. test, staging, production */
  environment?: string | string[];
  /** e.g. database, file, api */
  resourceType?: string | string[];
  destructiveOperation?: boolean;
  productionTarget?: boolean;
  /** Inclusive minimum export / record count. */
  dataExportSizeMin?: number;
  /** Inclusive maximum export / record count. */
  dataExportSizeMax?: number;
}

export interface PolicyRuleDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  decision: PolicyDecisionOutcome;
  conditions: PolicyConditions;
}

export interface PolicyEvaluationContext {
  toolName: string;
  actionType: string;
  amount?: number;
  currency?: string;
  environment?: string;
  resourceType?: string;
  destructiveOperation: boolean;
  productionTarget: boolean;
  dataExportSize?: number;
}

export interface MatchedPolicyReason {
  policyId: string;
  name: string;
  decision: PolicyDecisionOutcome;
  reason: string;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecisionOutcome;
  matchedPolicies: MatchedPolicyReason[];
}

export const DECISION_RANK: Record<PolicyDecisionOutcome, number> = {
  ALLOW: 1,
  REVIEW: 2,
  BLOCK: 3,
};

export function policyDecisionToDb(
  decision: PolicyDecisionOutcome
): DbPolicyDecision {
  const map: Record<PolicyDecisionOutcome, DbPolicyDecision> = {
    ALLOW: "allow",
    REVIEW: "review",
    BLOCK: "block",
  };
  return map[decision];
}

export function policyDecisionFromDb(
  value: string | null | undefined
): PolicyDecisionOutcome | null {
  switch (value?.toLowerCase()) {
    case "allow":
      return "ALLOW";
    case "review":
      return "REVIEW";
    case "block":
      return "BLOCK";
    default:
      return null;
  }
}

export function decisionToProposalStatus(
  decision: PolicyDecisionOutcome
): import("@/lib/gateway/proposals/types").GatewayProposalStatus {
  switch (decision) {
    case "ALLOW":
      return "allowed";
    case "REVIEW":
      return "review_required";
    case "BLOCK":
      return "blocked";
  }
}
