import type { PendingApproval } from "@/lib/approval-types";
import type { StoredRiskReasons } from "@/lib/gateway/proposals/enrichment";
import { extractMatchedPoliciesFromRiskReasons } from "@/lib/gateway/proposals/enrichment";
import type { RiskSeverity } from "@/lib/risk-types";
import { riskScoreToRiskLevel } from "@/lib/xai/score-action-risk";

export type RiskFactorDirection = "increase" | "decrease" | "neutral";
export type RiskFactorSource = "grok" | "policy" | "ai" | "shadow";
export type RiskScoreBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface StoredGrokRiskFactor {
  label: string;
  weight: number;
  direction: "increase" | "decrease";
}

export interface RiskScoreFactor {
  label: string;
  /** Null when the source did not provide a numeric contribution. */
  weight: number | null;
  direction: RiskFactorDirection;
  source: RiskFactorSource;
  /** Minor contextual signals use a warning icon instead of a check. */
  emphasis: "primary" | "warning";
}

export interface RiskScoreBreakdownView {
  score: number;
  band: RiskScoreBand;
  scoreDisplay: string;
  sectionTitle: string;
  factors: RiskScoreFactor[];
  hasWeightedFactors: boolean;
  summaryReason: string | null;
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.abs(value), 1));
}

function normalizeStoredScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) {
    return null;
  }

  if (score > 1) {
    return Math.max(0, Math.min(score / 100, 1));
  }

  return Math.max(0, Math.min(score, 1));
}

export function riskScoreBandFromNormalized(score: number): RiskScoreBand {
  const level = riskScoreToRiskLevel(score);
  switch (level) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

export function riskScoreSectionTitle(band: RiskScoreBand): string {
  switch (band) {
    case "CRITICAL":
    case "HIGH":
      return "WHY WAS THIS SCORED HIGH?";
    case "MEDIUM":
      return "WHY WAS THIS SCORED MEDIUM?";
    default:
      return "WHY WAS THIS SCORED LOW?";
  }
}

export function formatRiskFactorDelta(factor: RiskScoreFactor): string | null {
  if (factor.weight == null || !Number.isFinite(factor.weight)) {
    return null;
  }

  const signed =
    factor.direction === "decrease" ? -clampWeight(factor.weight) : clampWeight(factor.weight);
  const formatted = signed >= 0 ? `+${signed.toFixed(2)}` : signed.toFixed(2);
  return `(${formatted})`;
}

function parseStoredRiskReasons(value: unknown): StoredRiskReasons {
  if (typeof value === "object" && value !== null && "matchedPolicies" in value) {
    return value as StoredRiskReasons;
  }

  return {
    matchedPolicies: extractMatchedPoliciesFromRiskReasons(value),
  };
}

function parseGrokFactors(raw: unknown): StoredGrokRiskFactor[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const factors: StoredGrokRiskFactor[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const weight = typeof record.weight === "number" ? record.weight : null;
    const direction = record.direction;

    if (!label || weight == null || !Number.isFinite(weight)) {
      continue;
    }

    if (direction !== "increase" && direction !== "decrease") {
      continue;
    }

    factors.push({
      label,
      weight: clampWeight(weight),
      direction,
    });
  }

  return factors;
}

function grokFactorToView(factor: StoredGrokRiskFactor): RiskScoreFactor {
  const weight = clampWeight(factor.weight);
  return {
    label: factor.label,
    weight,
    direction: factor.direction,
    source: "grok",
    emphasis: factor.direction === "increase" && weight < 0.05 ? "warning" : "primary",
  };
}

function labelExists(factors: RiskScoreFactor[], label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return factors.some((factor) => factor.label.trim().toLowerCase() === normalized);
}

function appendUnweightedFactor(
  factors: RiskScoreFactor[],
  label: string,
  source: RiskFactorSource,
  direction: RiskFactorDirection = "increase"
): void {
  const trimmed = label.trim();
  if (!trimmed || labelExists(factors, trimmed)) {
    return;
  }

  factors.push({
    label: trimmed,
    weight: null,
    direction,
    source,
    emphasis: "primary",
  });
}

function resolveScore(params: {
  riskScore?: number | null;
  stored?: StoredRiskReasons;
  shadowScore?: number | null;
}): number | null {
  const fromRow = normalizeStoredScore(params.riskScore ?? null);
  if (fromRow != null) {
    return fromRow;
  }

  const grokScore = normalizeStoredScore(params.stored?.grok?.riskScore ?? null);
  if (grokScore != null) {
    return grokScore;
  }

  return normalizeStoredScore(params.shadowScore ?? null);
}

/** Builds an explainable risk score breakdown from stored proposal data. */
export function buildRiskScoreBreakdown(params: {
  riskScore?: number | null;
  riskSeverity?: RiskSeverity;
  riskReasons?: unknown;
  matchedPolicies?: PendingApproval["matchedPolicies"];
  aiRiskReasons?: string[];
  shadowReasons?: string[];
  shadowSignalLabels?: string[];
}): RiskScoreBreakdownView | null {
  const stored = parseStoredRiskReasons(params.riskReasons ?? null);
  const score = resolveScore({
    riskScore: params.riskScore,
    stored,
    shadowScore: null,
  });

  if (score == null) {
    return null;
  }

  const band = riskScoreBandFromNormalized(score);
  const factors: RiskScoreFactor[] = [];

  for (const factor of parseGrokFactors(stored.grok?.factors)) {
    factors.push(grokFactorToView(factor));
  }

  const grokReason = stored.grok?.reason?.trim();
  if (grokReason && factors.length === 0) {
    appendUnweightedFactor(factors, grokReason, "grok");
  }

  for (const policy of params.matchedPolicies ?? stored.matchedPolicies ?? []) {
    if (policy.decision !== "REVIEW" && policy.decision !== "BLOCK") {
      continue;
    }

    const label = policy.reason?.trim()
      ? policy.reason.trim()
      : policy.name?.trim()
        ? `${policy.name} (${policy.decision.toLowerCase()})`
        : null;

    if (label) {
      appendUnweightedFactor(factors, label, "policy");
    }
  }

  for (const reason of params.aiRiskReasons ?? stored.ai?.riskReasons ?? []) {
    if (typeof reason === "string" && reason.trim()) {
      appendUnweightedFactor(factors, reason.trim(), "ai");
    }
  }

  for (const reason of params.shadowReasons ?? []) {
    if (reason.trim()) {
      appendUnweightedFactor(factors, reason.trim(), "shadow");
    }
  }

  for (const signal of params.shadowSignalLabels ?? []) {
    if (signal.trim()) {
      appendUnweightedFactor(factors, signal.trim(), "shadow");
    }
  }

  return {
    score,
    band,
    scoreDisplay: `${score.toFixed(2)} (${band})`,
    sectionTitle: riskScoreSectionTitle(band),
    factors: factors.slice(0, 8),
    hasWeightedFactors: factors.some((factor) => factor.weight != null),
    summaryReason: grokReason ?? null,
  };
}

export function buildRiskScoreBreakdownFromApproval(
  approval: PendingApproval
): RiskScoreBreakdownView | null {
  if (approval.riskScoreBreakdown) {
    return approval.riskScoreBreakdown;
  }

  return buildRiskScoreBreakdown({
    riskScore: approval.riskScore,
    riskSeverity: approval.riskSeverity,
    matchedPolicies: approval.matchedPolicies,
    aiRiskReasons: approval.aiRiskReasons,
    shadowReasons: approval.shadowRisk?.reasons,
    shadowSignalLabels: approval.shadowRisk?.signalLabels,
  });
}
