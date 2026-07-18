import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import type { ExplainableRiskAssessment } from "./assessment";
import type { DeterministicRiskSignal, RiskContext } from "./signals";
import { sanitizeRiskContextForClassifier } from "./signals";
import { SHADOW_CLASSIFIER_VERSION } from "./classifier";

/** Explicit marker — shadow output is observational only. */
export const SHADOW_RISK_MODE = "shadow" as const;

export type ShadowClassifierStatus = "completed" | "failed";

export interface StoredShadowRiskAssessment {
  mode: typeof SHADOW_RISK_MODE;
  status: "completed";
  proposalId: string;
  actionHash: string;
  classifierVersion: string;
  classifierStatus: Extract<ShadowClassifierStatus, "completed">;
  latencyMs: number;
  assessedAt: string;
  /** Authoritative deterministic decision at assessment time (unchanged by shadow). */
  policyDecision: PolicyDecisionOutcome;
  /** Structured signals derived deterministically before LLM classification. */
  deterministicSignals: DeterministicRiskSignal[];
  /** Typed risk context snapshot (sanitized, no secrets). */
  riskContext: Record<string, unknown>;
  /** Unified explainable assessment (deterministic facts + contextual interpretation). */
  assessment: ExplainableRiskAssessment;
}

export interface StoredShadowRiskFailure {
  mode: typeof SHADOW_RISK_MODE;
  status: "failed";
  proposalId: string;
  actionHash: string;
  classifierVersion: string;
  classifierStatus: Extract<ShadowClassifierStatus, "failed">;
  latencyMs: number;
  assessedAt: string;
  policyDecision: PolicyDecisionOutcome;
  deterministicSignals: DeterministicRiskSignal[];
  riskContext: Record<string, unknown>;
  failure: {
    code: string;
    message: string;
  };
}

export type StoredShadowRiskRecord =
  | StoredShadowRiskAssessment
  | StoredShadowRiskFailure;

export function extractShadowRiskRecord(value: unknown): StoredShadowRiskRecord | null {
  if (typeof value !== "object" || value === null || !("shadow" in value)) {
    return null;
  }

  const shadow = (value as { shadow?: unknown }).shadow;
  if (typeof shadow !== "object" || shadow === null) {
    return null;
  }

  const record = shadow as Partial<StoredShadowRiskRecord>;
  if (
    record.mode === SHADOW_RISK_MODE &&
    typeof record.proposalId === "string" &&
    typeof record.actionHash === "string" &&
    typeof record.classifierVersion === "string" &&
    typeof record.assessedAt === "string" &&
    (record.status === "completed" || record.status === "failed")
  ) {
    return record as StoredShadowRiskRecord;
  }

  return null;
}

export function buildCompletedShadowRecord(params: {
  proposalId: string;
  actionHash: string;
  policyDecision: PolicyDecisionOutcome;
  assessment: ExplainableRiskAssessment;
  deterministicSignals: DeterministicRiskSignal[];
  riskContext: RiskContext;
  assessedAt?: string;
}): StoredShadowRiskAssessment {
  return {
    mode: SHADOW_RISK_MODE,
    status: "completed",
    proposalId: params.proposalId,
    actionHash: params.actionHash,
    classifierVersion: params.assessment.classifierVersion ?? SHADOW_CLASSIFIER_VERSION,
    classifierStatus: "completed",
    latencyMs: params.assessment.latencyMs,
    assessedAt: params.assessedAt ?? new Date().toISOString(),
    policyDecision: params.policyDecision,
    deterministicSignals: params.deterministicSignals,
    riskContext: sanitizeRiskContextForClassifier(params.riskContext),
    assessment: params.assessment,
  };
}

export function buildFailedShadowRecord(params: {
  proposalId: string;
  actionHash: string;
  policyDecision: PolicyDecisionOutcome;
  deterministicSignals: DeterministicRiskSignal[];
  riskContext: RiskContext;
  code: string;
  message: string;
  latencyMs: number;
  assessedAt?: string;
}): StoredShadowRiskFailure {
  return {
    mode: SHADOW_RISK_MODE,
    status: "failed",
    proposalId: params.proposalId,
    actionHash: params.actionHash,
    classifierVersion: SHADOW_CLASSIFIER_VERSION,
    classifierStatus: "failed",
    latencyMs: params.latencyMs,
    assessedAt: params.assessedAt ?? new Date().toISOString(),
    policyDecision: params.policyDecision,
    deterministicSignals: params.deterministicSignals,
    riskContext: sanitizeRiskContextForClassifier(params.riskContext),
    failure: {
      code: params.code,
      message: params.message,
    },
  };
}
