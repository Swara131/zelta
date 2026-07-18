/** How risk assessments interact with gateway decisions. Default: observational only. */
export type RiskEnforcementMode = "shadow" | "enforce" | "hybrid";

/** When classifier is unavailable in enforce mode, whether ALLOW is preserved or escalated. */
export type RiskFailsafeMode = "preserve" | "review";

/** Conservative default for hybrid ALLOW→REVIEW escalation confidence gate. */
export const DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD = 0.7;

const ENFORCEMENT_VALUES = new Set<RiskEnforcementMode>(["shadow", "enforce", "hybrid"]);
const FAILSAFE_VALUES = new Set<RiskFailsafeMode>(["preserve", "review"]);

export function parseRiskEnforcementMode(
  value: string | undefined
): RiskEnforcementMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized && ENFORCEMENT_VALUES.has(normalized as RiskEnforcementMode)) {
    return normalized as RiskEnforcementMode;
  }
  return "shadow";
}

export function parseRiskFailsafeMode(value: string | undefined): RiskFailsafeMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized && FAILSAFE_VALUES.has(normalized as RiskFailsafeMode)) {
    return normalized as RiskFailsafeMode;
  }
  return "preserve";
}

export function getRiskEnforcementMode(): RiskEnforcementMode {
  return parseRiskEnforcementMode(process.env.RISK_ENFORCEMENT_MODE);
}

export function getRiskFailsafeMode(): RiskFailsafeMode {
  return parseRiskFailsafeMode(process.env.RISK_FAILSAFE_ON_UNAVAILABLE);
}

export function parseRiskHybridConfidenceThreshold(value: string | undefined): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD;
  }
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }
  return DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD;
}

export function getRiskHybridConfidenceThreshold(): number {
  return parseRiskHybridConfidenceThreshold(process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD);
}
