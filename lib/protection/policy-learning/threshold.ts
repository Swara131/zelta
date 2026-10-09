import type { StructuredProtectionConfig } from "@/lib/protection/structured-rules";

const THRESHOLD_PATTERN = /₹?\s*([\d,]+)/;

export function parseThresholdInrFromCondition(condition: string): number | null {
  const match = condition.match(THRESHOLD_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function readRefundThresholdFromStructuredRules(
  config: StructuredProtectionConfig,
  fallback = 5_000
): number {
  const allowRule = config.rules.find((rule) => rule.id === "rule-refund-allow");
  if (!allowRule) {
    return fallback;
  }

  return parseThresholdInrFromCondition(allowRule.condition) ?? fallback;
}
