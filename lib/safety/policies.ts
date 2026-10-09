import type { PolicyRuleDefinition } from "@/lib/gateway/policy/types";
import type {
  AgentSafetySettings,
  AgentSafetySettingsExtended,
  SafetyPolicy,
} from "@/lib/agents/runtime-types";
import {
  buildAgentSafetyPolicyRules,
  getZeltaProtectionPolicies,
} from "@/lib/agents/protection/rules";
import type { LoadedAgent } from "@/lib/agents/runtime/types";
import type { SafetyDecision } from "./types";

function mapSafetyDecisionToPolicy(decision: SafetyDecision): PolicyRuleDefinition["decision"] {
  if (decision === "REQUIRE_APPROVAL") return "REVIEW";
  return decision;
}

/** Converts user-defined SafetyPolicy entries into gateway policy rule definitions. */
export function safetyPoliciesToRules(policies: SafetyPolicy[] | undefined): PolicyRuleDefinition[] {
  if (!policies?.length) return [];

  return policies.map((policy, index) => ({
    id: policy.id,
    name: policy.name,
    description: policy.description,
    priority: policy.priority ?? 100 + index,
    decision: mapSafetyDecisionToPolicy(policy.decision),
    conditions: {
      ...(policy.condition ?? {}),
      ...(policy.tool ? { toolName: policy.tool } : {}),
      ...(policy.action ? { actionType: policy.action } : {}),
    },
  }));
}

/** Builds the full policy rule set for an agent (platform defaults + agent settings + custom policies). */
export function buildSafetyPolicyRulesForAgent(agent: LoadedAgent): PolicyRuleDefinition[] {
  const safety = (agent.record.safetySettings ?? {}) as AgentSafetySettings &
    AgentSafetySettingsExtended;
  const thresholdInr =
    safety.thresholdInr ?? agent.record.suggestedThreshold ?? 5000;

  return [
    ...getZeltaProtectionPolicies(),
    ...buildAgentSafetyPolicyRules(safety, thresholdInr),
    ...safetyPoliciesToRules(safety.policies),
  ];
}

export function mapPolicyDecisionToSafety(
  decision: PolicyRuleDefinition["decision"]
): SafetyDecision {
  if (decision === "REVIEW") return "REQUIRE_APPROVAL";
  return decision;
}
