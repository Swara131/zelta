import {
  parseExplainableRiskAssessment,
  type ExplainableRiskAssessment,
  type ShadowRecommendedDecision,
  type ShadowRiskAssessment,
  type ShadowRiskLevel,
  type ShadowRiskSignal,
} from "./assessment";
import { classifyRisk, type ShadowRiskClassifierContext } from "./classifier";
import type { DeterministicRiskSignal } from "./signals";

export const UNCERTAINTY_CONFIDENCE_THRESHOLD = 0.5;
export const HIGH_RISK_SCORE_THRESHOLD = 70;

const MAX_REASONS = 5;
const MAX_REASON_LENGTH = 240;

const CHAIN_OF_THOUGHT_PATTERN =
  /^(step\s+\d+|let me think|first,?\s+i|reasoning:|analysis:)/i;

function sanitizeReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length <= MAX_REASON_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_REASON_LENGTH - 1)}…`;
}

/** Keeps concise user-facing reasons; drops chain-of-thought phrasing. */
export function sanitizeAssessmentReasons(reasons: string[]): string[] {
  return reasons
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0)
    .filter((reason) => !CHAIN_OF_THOUGHT_PATTERN.test(reason))
    .slice(0, MAX_REASONS)
    .map(sanitizeReason);
}

function contextualSignalCode(code: string): string {
  return code.startsWith("contextual.") ? code : `contextual.${code}`;
}

function filterContextualSignals(
  deterministicSignals: DeterministicRiskSignal[],
  contextualSignals: ShadowRiskSignal[]
): ShadowRiskSignal[] {
  const deterministicCodes = new Set(deterministicSignals.map((signal) => signal.code));

  return contextualSignals.filter((signal) => {
    const normalized = contextualSignalCode(signal.code);
    return !deterministicCodes.has(normalized) && !deterministicCodes.has(signal.code);
  });
}

/** Enforces shadow advisory guardrails — never returns block. */
export function applyRecommendationGuardrails(input: {
  riskLevel: ShadowRiskLevel;
  score: number;
  confidence: number;
  recommendedDecision: ShadowRecommendedDecision;
}): ShadowRecommendedDecision {
  if (input.riskLevel === "critical" || input.riskLevel === "high") {
    return "review";
  }
  if (input.score >= HIGH_RISK_SCORE_THRESHOLD) {
    return "review";
  }
  if (input.confidence < UNCERTAINTY_CONFIDENCE_THRESHOLD) {
    return "review";
  }
  return input.recommendedDecision;
}

/** Combines authoritative deterministic signals with contextual LLM interpretation. */
export function mergeExplainableAssessment(
  deterministicSignals: DeterministicRiskSignal[],
  contextualAssessment: ShadowRiskAssessment,
  latencyMs: number
): ExplainableRiskAssessment {
  const contextualSignals = filterContextualSignals(
    deterministicSignals,
    contextualAssessment.signals
  ).map((signal) => ({
    ...signal,
    code: contextualSignalCode(signal.code),
  }));

  const signals = [
    ...deterministicSignals.map((signal) => ({
      code: signal.code,
      description: signal.description,
      severity: signal.severity,
      source: "deterministic" as const,
    })),
    ...contextualSignals.map((signal) => ({
      ...signal,
      source: "contextual" as const,
    })),
  ];

  const deterministicSignalCodes = deterministicSignals.map((signal) => signal.code);
  const signalCodes = signals.map((signal) => signal.code);

  const recommendedDecision = applyRecommendationGuardrails({
    riskLevel: contextualAssessment.riskLevel,
    score: contextualAssessment.score,
    confidence: contextualAssessment.confidence,
    recommendedDecision: contextualAssessment.recommendedDecision,
  });

  const assessment = {
    riskLevel: contextualAssessment.riskLevel,
    score: contextualAssessment.score,
    confidence: contextualAssessment.confidence,
    reasons: sanitizeAssessmentReasons(contextualAssessment.reasons),
    signalCodes,
    signals,
    deterministicSignalCodes,
    contextualSignals,
    recommendedDecision,
    modelProvider: contextualAssessment.modelProvider,
    modelName: contextualAssessment.modelName,
    classifierVersion: contextualAssessment.classifierVersion,
    classifierStatus: "completed" as const,
    latencyMs,
  };

  return parseExplainableRiskAssessment(assessment);
}

export interface EvaluateExplainableRiskDeps {
  classifyRisk?: typeof classifyRisk;
}

/**
 * Runs contextual shadow classification and merges it with deterministic signals.
 * Throws on provider failure — callers must handle safely (e.g. shadow-integration).
 */
export async function evaluateExplainableRisk(
  context: ShadowRiskClassifierContext,
  deterministicSignals: DeterministicRiskSignal[],
  deps: EvaluateExplainableRiskDeps = {}
): Promise<ExplainableRiskAssessment> {
  const classify = deps.classifyRisk ?? classifyRisk;
  const startedAt = Date.now();
  const contextualAssessment = await classify(context);
  const latencyMs = Date.now() - startedAt;

  if (contextualAssessment.classifierVersion.trim().length === 0) {
    throw new Error("Shadow assessment missing classifierVersion.");
  }

  return mergeExplainableAssessment(deterministicSignals, contextualAssessment, latencyMs);
}

/** Builds example assessments for docs/tests without calling a provider. */
export function buildExampleExplainableAssessment(params: {
  deterministicSignals: DeterministicRiskSignal[];
  contextualAssessment: ShadowRiskAssessment;
  latencyMs?: number;
}): ExplainableRiskAssessment {
  return mergeExplainableAssessment(
    params.deterministicSignals,
    params.contextualAssessment,
    params.latencyMs ?? 120
  );
}
