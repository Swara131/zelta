import { conditionsMatch } from "./conditions";
import { buildPolicyEvaluationContext } from "./context";
import { getDefaultDemoPolicies } from "./demo-policies";
import type {
  MatchedPolicyReason,
  PolicyDecisionOutcome,
  PolicyEvaluationResult,
  PolicyRuleDefinition,
} from "./types";
import { DECISION_RANK as RANK } from "./types";

export interface EvaluatePolicyInput {
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  rules?: PolicyRuleDefinition[];
}

/** Aggregates matched rule decisions — BLOCK beats REVIEW beats ALLOW. */
export function aggregatePolicyDecision(
  matches: MatchedPolicyReason[]
): PolicyDecisionOutcome {
  if (matches.length === 0) {
    return "REVIEW";
  }

  let strongest: PolicyDecisionOutcome = "ALLOW";

  for (const match of matches) {
    if (RANK[match.decision] > RANK[strongest]) {
      strongest = match.decision;
    }
  }

  return strongest;
}

/**
 * Deterministic policy evaluation — no AI involvement.
 * Evaluates all enabled rules and returns every match plus the final decision.
 */
export function evaluatePolicy(input: EvaluatePolicyInput): PolicyEvaluationResult {
  const context = buildPolicyEvaluationContext({
    toolName: input.toolName,
    actionType: input.actionType,
    payload: input.payload,
  });

  const rules = [...(input.rules ?? getDefaultDemoPolicies())].sort(
    (a, b) => a.priority - b.priority
  );

  const matchedPolicies: MatchedPolicyReason[] = [];

  for (const rule of rules) {
    if (!conditionsMatch(context, rule.conditions)) {
      continue;
    }

    matchedPolicies.push({
      policyId: rule.id,
      name: rule.name,
      decision: rule.decision,
      reason: rule.description,
    });
  }

  return {
    decision: aggregatePolicyDecision(matchedPolicies),
    matchedPolicies,
  };
}

export { buildPolicyEvaluationContext, conditionsMatch, getDefaultDemoPolicies };
