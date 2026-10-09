import type { StructuredProtectionConfig } from "@/lib/protection/structured-rules";
import { formatInrMajor } from "./amount";
import type { PolicyLearningSuggestion } from "./types";

export function applyPolicyLearningSuggestion(
  config: StructuredProtectionConfig,
  suggestion: Pick<
    PolicyLearningSuggestion,
    "kind" | "thresholdInr" | "toolName" | "actionLabel"
  >
): StructuredProtectionConfig {
  if (suggestion.kind === "raise_refund_threshold" && suggestion.thresholdInr) {
    return applyRefundThreshold(config, suggestion.thresholdInr);
  }

  if (suggestion.kind === "auto_approve_pattern" && suggestion.toolName) {
    return applyAutoApprovePattern(config, {
      toolName: suggestion.toolName,
      actionLabel: suggestion.actionLabel ?? suggestion.toolName.replace(/_/g, " "),
    });
  }

  return config;
}

export function applyRefundThreshold(
  config: StructuredProtectionConfig,
  thresholdInr: number
): StructuredProtectionConfig {
  const thresholdLabel = formatInrMajor(thresholdInr);

  return {
    rules: config.rules.map((rule) => {
      if (rule.id === "rule-refund-allow") {
        return {
          ...rule,
          condition: `Up to ${thresholdLabel}`,
          explanation: `Refunds up to ${thresholdLabel} can proceed without asking you first.`,
          decision: "ALLOW",
        };
      }

      if (rule.id === "rule-refund-review") {
        return {
          ...rule,
          condition: `Above ${thresholdLabel}`,
          explanation: `Refunds above ${thresholdLabel} need your approval before money moves.`,
          decision: "REVIEW",
        };
      }

      return rule;
    }),
  };
}

function applyAutoApprovePattern(
  config: StructuredProtectionConfig,
  params: { toolName: string; actionLabel: string }
): StructuredProtectionConfig {
  const ruleId = `rule-learned-auto-${params.toolName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const existingIndex = config.rules.findIndex((rule) => rule.id === ruleId);

  const learnedRule = {
    id: ruleId,
    action: params.actionLabel,
    condition: "Learned low-risk pattern",
    explanation: "Wave learned you almost always approve this — it can proceed automatically.",
    decision: "ALLOW" as const,
  };

  if (existingIndex >= 0) {
    const rules = [...config.rules];
    rules[existingIndex] = learnedRule;
    return { rules };
  }

  return {
    rules: [learnedRule, ...config.rules],
  };
}
