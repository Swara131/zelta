import type {
  AgentApprovalRuleRecord,
  AgentExecutionLimitRecord,
  AgentSafetyPolicyRecord,
  AgentToolPermissionRecord,
  SafetyEvaluationResult,
  SafetyRecommendation,
  SafetyScoreFactor,
  SafetyScoreStatus,
  ToolPermissionLevel,
} from "./types";
import { getAutopilotTool, isHighRiskPermission } from "./tools-catalog";

const PERMISSION_RISK: Record<ToolPermissionLevel, number> = {
  disabled: 0,
  read_only: 1,
  draft_only: 2,
  ask_approval: 3,
  automatic: 8,
};

/**
 * Safety score model (transparent, configuration-based):
 * - Start at 100.
 * - Deduct for automatic/high-impact tool permissions (up to 35 pts).
 * - Deduct for disabled data protections (up to 25 pts).
 * - Deduct for disabled approval rules (up to 20 pts).
 * - Deduct for missing or loose execution limits (up to 20 pts).
 * - Small bonus (+5 max) when all protections enabled and mode is "safe".
 * Score is clamped to [0, 100].
 */
export function evaluateSafetyPolicy(input: {
  policy: AgentSafetyPolicyRecord;
  permissions: AgentToolPermissionRecord[];
  approvalRules: AgentApprovalRuleRecord[];
  limits: AgentExecutionLimitRecord;
}): SafetyEvaluationResult {
  const { policy, permissions, approvalRules, limits } = input;
  let score = 100;
  const factors: SafetyScoreFactor[] = [];
  const recommendations: SafetyRecommendation[] = [];

  let permissionDeduction = 0;
  for (const perm of permissions) {
    if (perm.revokedAt) continue;
    const risk = PERMISSION_RISK[perm.permissionLevel];
    if (risk >= 8) {
      permissionDeduction += 12;
      factors.push({
        id: `perm-${perm.toolId}`,
        label: `${perm.toolLabel} can act automatically`,
        impact: 12,
        direction: "negative",
      });
      recommendations.push({
        id: `fix-perm-${perm.toolId}`,
        message: `Require approval before ${perm.toolLabel} writes or sends.`,
        severity: perm.isHighRisk ? "high" : "medium",
        fixAction: "set_tool_permission",
        fixPayload: { toolId: perm.toolId, permissionLevel: "ask_approval" },
      });
    } else if (risk >= 3 && perm.isHighRisk) {
      permissionDeduction += 4;
    }
    const catalogTool = getAutopilotTool(perm.toolId);
    if (catalogTool && isHighRiskPermission(catalogTool, perm.permissionLevel)) {
      recommendations.push({
        id: `highlight-${perm.toolId}`,
        message: `Review high-risk access for ${perm.toolLabel}.`,
        severity: "high",
        fixAction: "set_tool_permission",
        fixPayload: { toolId: perm.toolId, permissionLevel: "ask_approval" },
      });
    }
  }
  permissionDeduction = Math.min(permissionDeduction, 35);
  score -= permissionDeduction;

  const dp = policy.dataProtection;
  const protectionFields: Array<[keyof typeof dp, string, string]> = [
    ["promptInjectionDefense", "Prompt injection defense", "Enable prompt injection defense."],
    ["secretDetection", "Secret detection", "Enable secret detection and redaction."],
    ["piiDetection", "PII masking", "Enable PII detection and masking."],
    ["blockPromptExtraction", "Prompt extraction blocking", "Block system prompt extraction attempts."],
    ["restrictSensitiveKb", "Sensitive document access", "Restrict access to sensitive knowledge-base documents."],
  ];
  let protectionDeduction = 0;
  for (const [key, label, fixMsg] of protectionFields) {
    if (!dp[key]) {
      protectionDeduction += 5;
      factors.push({ id: `dp-${key}`, label: `${label} is off`, impact: 5, direction: "negative" });
      recommendations.push({
        id: `fix-dp-${key}`,
        message: fixMsg,
        severity: "medium",
        fixAction: "enable_data_protection",
        fixPayload: { key },
      });
    }
  }
  protectionDeduction = Math.min(protectionDeduction, 25);
  score -= protectionDeduction;

  const disabledRules = approvalRules.filter((r) => !r.enabled);
  const ruleDeduction = Math.min(disabledRules.length * 4, 20);
  score -= ruleDeduction;
  for (const rule of disabledRules.slice(0, 3)) {
    factors.push({
      id: `rule-${rule.ruleKey}`,
      label: `Approval rule "${formatRuleLabel(rule.ruleKey)}" is off`,
      impact: 4,
      direction: "negative",
    });
    recommendations.push({
      id: `fix-rule-${rule.ruleKey}`,
      message: `Enable approval before ${formatRuleLabel(rule.ruleKey).toLowerCase()}.`,
      severity: "medium",
      fixAction: "enable_approval_rule",
      fixPayload: { ruleKey: rule.ruleKey },
    });
  }

  let limitDeduction = 0;
  if (limits.dailySpendingCapUsd == null || limits.dailySpendingCapUsd <= 0) {
    limitDeduction += 8;
    factors.push({ id: "limit-daily", label: "No daily spending cap", impact: 8, direction: "negative" });
    recommendations.push({
      id: "fix-daily-cap",
      message: "Set a daily cost cap.",
      severity: "high",
      fixAction: "set_limit",
      fixPayload: { field: "dailySpendingCapUsd", value: 25 },
    });
  }
  if (limits.maxCostPerRunUsd == null || limits.maxCostPerRunUsd <= 0) {
    limitDeduction += 6;
    recommendations.push({
      id: "fix-run-cost",
      message: "Set a maximum cost per agent run.",
      severity: "medium",
      fixAction: "set_limit",
      fixPayload: { field: "maxCostPerRunUsd", value: 2 },
    });
  }
  if (limits.maxToolCallsPerRun == null || limits.maxToolCallsPerRun > 200) {
    limitDeduction += 4;
    if (limits.maxToolCallsPerRun != null && limits.maxToolCallsPerRun > 200) {
      recommendations.push({
        id: "fix-tool-calls",
        message: `Reduce tool call limit from ${limits.maxToolCallsPerRun} to 100.`,
        severity: "low",
        fixAction: "set_limit",
        fixPayload: { field: "maxToolCallsPerRun", value: 100 },
      });
    }
  }
  if (limits.maxMessagesPerRun != null && limits.maxMessagesPerRun > 500) {
    limitDeduction += 4;
    recommendations.push({
      id: "fix-messages",
      message: `Reduce message limit from ${limits.maxMessagesPerRun} to 100.`,
      severity: "medium",
      fixAction: "set_limit",
      fixPayload: { field: "maxMessagesPerRun", value: 100 },
    });
  }
  limitDeduction = Math.min(limitDeduction, 20);
  score -= limitDeduction;

  if (
    policy.protectionMode === "safe" &&
    protectionDeduction === 0 &&
    permissionDeduction <= 8
  ) {
    score = Math.min(100, score + 5);
    factors.push({
      id: "bonus-safe",
      label: "Safe mode with protections enabled",
      impact: 5,
      direction: "positive",
    });
  }

  if (policy.protectionMode === "autonomous") {
    score -= 5;
    factors.push({
      id: "mode-autonomous",
      label: "Autonomous protection mode",
      impact: 5,
      direction: "negative",
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const status = scoreToStatus(score);
  const topFactors = [...factors]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  const uniqueRecommendations = dedupeRecommendations(recommendations);

  return {
    score,
    status,
    factors: topFactors,
    recommendations: uniqueRecommendations.slice(0, 8),
  };
}

function scoreToStatus(score: number): SafetyScoreStatus {
  if (score >= 75) return "protected";
  if (score >= 50) return "needs_attention";
  return "high_risk";
}

function formatRuleLabel(ruleKey: string): string {
  return ruleKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function dedupeRecommendations(items: SafetyRecommendation[]): SafetyRecommendation[] {
  const seen = new Set<string>();
  const out: SafetyRecommendation[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function buildPolicySummary(
  approvalRules: AgentApprovalRuleRecord[],
  limits: AgentExecutionLimitRecord
): string[] {
  const lines: string[] = [];
  for (const rule of approvalRules) {
    if (!rule.enabled) continue;
    switch (rule.ruleKey) {
      case "send_message":
        if (rule.thresholdValue != null) {
          lines.push(
            `Wave will ask for approval before sending messages to more than ${rule.thresholdValue} recipients.`
          );
        } else {
          lines.push("Wave will ask for approval before sending messages.");
        }
        break;
      case "process_payments":
        if (rule.thresholdValue != null) {
          lines.push(
            `Wave will ask for approval before processing payments or refunds over $${rule.thresholdValue}.`
          );
        }
        break;
      case "delete_data":
        if (rule.thresholdValue != null) {
          lines.push(
            `Wave will ask for approval before deleting more than ${rule.thresholdValue} records.`
          );
        }
        break;
      default:
        lines.push(`Wave will ask for approval before ${formatRuleLabel(rule.ruleKey).toLowerCase()}.`);
    }
  }
  if (limits.maxCostPerRunUsd != null) {
    lines.push(`Each run is capped at $${limits.maxCostPerRunUsd} estimated cost.`);
  }
  if (limits.dailySpendingCapUsd != null) {
    lines.push(`Daily spending is capped at $${limits.dailySpendingCapUsd}.`);
  }
  return lines;
}

export function estimateLimitRiskLabel(
  limits: AgentExecutionLimitRecord
): "low" | "elevated" | "high" | null {
  if (
    (limits.dailySpendingCapUsd ?? 0) > 500 ||
    (limits.maxCostPerRunUsd ?? 0) > 50 ||
    (limits.maxMessagesPerRun ?? 0) > 1000
  ) {
    return "high";
  }
  if (
    (limits.dailySpendingCapUsd ?? 0) > 100 ||
    (limits.maxToolCallsPerRun ?? 0) > 150
  ) {
    return "elevated";
  }
  if (
    limits.dailySpendingCapUsd != null ||
    limits.maxCostPerRunUsd != null
  ) {
    return "low";
  }
  return null;
}
