import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import { policyDecisionFromDb } from "@/lib/gateway/policy/types";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  extractShadowRiskRecord,
  SHADOW_RISK_MODE,
  type StoredShadowRiskRecord,
} from "@/lib/gateway/risk/shadow-store";

export type ShadowRiskUiStatus = "none" | "pending" | "failed" | "completed";

export interface ShadowRiskDisplayView {
  status: ShadowRiskUiStatus;
  mode: typeof SHADOW_RISK_MODE;
  /** Authoritative gateway policy outcome. */
  gatewayDecision: PolicyDecisionOutcome | null;
  /** Shadow classifier advisory recommendation (never BLOCK). */
  shadowRecommendedDecision: "ALLOW" | "REVIEW" | null;
  riskLevel: RiskSeverity | null;
  score: number | null;
  confidence: number | null;
  reasons: string[];
  signalLabels: string[];
  classifierStatus: string | null;
  classifierVersion: string | null;
  modelProvider: string | null;
  modelName: string | null;
  latencyMs: number | null;
  assessedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

const SEVERITIES = new Set<RiskSeverity>(["critical", "high", "medium", "low"]);

function normalizeSeverity(value: string | null | undefined): RiskSeverity | null {
  const lower = value?.toLowerCase();
  return SEVERITIES.has(lower as RiskSeverity) ? (lower as RiskSeverity) : null;
}

function mapShadowRecommendation(
  value: string | null | undefined
): "ALLOW" | "REVIEW" | null {
  if (value === "allow") return "ALLOW";
  if (value === "review") return "REVIEW";
  return null;
}

/** Converts machine signal codes into concise human-readable labels. */
export function formatSignalCodeLabel(code: string): string {
  return code
    .replace(/^contextual\./, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function signalLabelsFromRecord(record: StoredShadowRiskRecord): string[] {
  if (record.status === "completed") {
    const fromSignals = record.assessment.signals
      .slice(0, 12)
      .map((signal) => signal.description.trim() || formatSignalCodeLabel(signal.code));
    if (fromSignals.length > 0) {
      return uniqueLabels(fromSignals);
    }
    return record.assessment.signalCodes.slice(0, 12).map(formatSignalCodeLabel);
  }

  return record.deterministicSignals
    .slice(0, 8)
    .map((signal) => signal.description.trim() || formatSignalCodeLabel(signal.code));
}

function completedView(
  record: StoredShadowRiskRecord & { status: "completed" },
  gatewayDecision: PolicyDecisionOutcome | null
): ShadowRiskDisplayView {
  const assessment = record.assessment;

  return {
    status: "completed",
    mode: SHADOW_RISK_MODE,
    gatewayDecision: gatewayDecision ?? record.policyDecision ?? null,
    shadowRecommendedDecision: mapShadowRecommendation(assessment.recommendedDecision),
    riskLevel: normalizeSeverity(assessment.riskLevel),
    score: assessment.score,
    confidence: assessment.confidence,
    reasons: assessment.reasons.slice(0, 5),
    signalLabels: signalLabelsFromRecord(record),
    classifierStatus: assessment.classifierStatus,
    classifierVersion: assessment.classifierVersion,
    modelProvider: assessment.modelProvider,
    modelName: assessment.modelName,
    latencyMs: assessment.latencyMs,
    assessedAt: record.assessedAt,
    failureCode: null,
    failureMessage: null,
  };
}

function failedView(
  record: StoredShadowRiskRecord & { status: "failed" },
  gatewayDecision: PolicyDecisionOutcome | null
): ShadowRiskDisplayView {
  return {
    status: "failed",
    mode: SHADOW_RISK_MODE,
    gatewayDecision: gatewayDecision ?? record.policyDecision ?? null,
    shadowRecommendedDecision: null,
    riskLevel: null,
    score: null,
    confidence: null,
    reasons: [],
    signalLabels: signalLabelsFromRecord(record),
    classifierStatus: record.classifierStatus,
    classifierVersion: record.classifierVersion,
    modelProvider: null,
    modelName: null,
    latencyMs: record.latencyMs,
    assessedAt: record.assessedAt,
    failureCode: record.failure.code,
    failureMessage: record.failure.message,
  };
}

/** Maps stored proposal risk_reasons into a UI-safe shadow risk view. */
export function mapShadowRiskDisplay(
  riskReasons: unknown,
  policyDecisionDb: string | null | undefined
): ShadowRiskDisplayView {
  const gatewayDecision = policyDecisionFromDb(policyDecisionDb);
  const shadow = extractShadowRiskRecord(riskReasons);

  if (!shadow) {
    return {
      status: "pending",
      mode: SHADOW_RISK_MODE,
      gatewayDecision,
      shadowRecommendedDecision: null,
      riskLevel: null,
      score: null,
      confidence: null,
      reasons: [],
      signalLabels: [],
      classifierStatus: null,
      classifierVersion: null,
      modelProvider: null,
      modelName: null,
      latencyMs: null,
      assessedAt: null,
      failureCode: null,
      failureMessage: null,
    };
  }

  if (shadow.status === "completed") {
    return completedView(shadow, gatewayDecision);
  }

  return failedView(shadow, gatewayDecision);
}

/** Builds a concise audit timeline description for risk assessment runtime events. */
export function buildAuditRiskAssessmentDescription(metadata: Record<string, unknown>): string {
  const event = metadata.event;
  const mode = metadata.mode === "shadow" ? "Shadow" : "Risk";
  const policyDecision =
    typeof metadata.policyDecision === "string" ? metadata.policyDecision : null;

  if (event === "risk.assessment_started") {
    const count =
      typeof metadata.deterministicSignalCount === "number"
        ? metadata.deterministicSignalCount
        : null;
    return count !== null
      ? `${mode} assessment started · ${count} deterministic signals · gateway ${policyDecision ?? "unknown"}`
      : `${mode} assessment started · gateway ${policyDecision ?? "unknown"}`;
  }

  if (event === "risk.assessment_completed" || event === "shadow.risk_analyzed") {
    const riskLevel = typeof metadata.riskLevel === "string" ? metadata.riskLevel : null;
    const score = typeof metadata.riskScore === "number" ? metadata.riskScore : null;
    const shadowRec =
      typeof metadata.shadowRecommendedDecision === "string"
        ? metadata.shadowRecommendedDecision.toUpperCase()
        : null;
    const latency =
      typeof metadata.latencyMs === "number" ? `${metadata.latencyMs}ms` : null;

    const parts = [
      `${mode} assessment completed`,
      riskLevel ? `level ${riskLevel}` : null,
      score !== null ? `score ${score}` : null,
      shadowRec ? `shadow recommends ${shadowRec}` : null,
      policyDecision ? `gateway ${policyDecision}` : null,
      latency,
    ].filter(Boolean);

    return parts.join(" · ");
  }

  if (event === "risk.assessment_failed" || event === "shadow.risk_failed") {
    const code = typeof metadata.code === "string" ? metadata.code : "unknown";
    const latency =
      typeof metadata.latencyMs === "number" ? `${metadata.latencyMs}ms` : null;
    return [`${mode} assessment failed`, code, latency].filter(Boolean).join(" · ");
  }

  return "";
}

export function isRiskAssessmentRuntimeEvent(runtimeEvent: string | null | undefined): boolean {
  if (!runtimeEvent) return false;
  return (
    runtimeEvent.startsWith("risk.assessment_") ||
    runtimeEvent.startsWith("shadow.risk_")
  );
}
