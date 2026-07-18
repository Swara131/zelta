import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import type { ExplainableRiskAssessment } from "./assessment";
import {
  classifyRisk,
  ShadowRiskClassifierError,
  type ShadowRiskClassifierContext,
} from "./classifier";
import { evaluateExplainableRisk } from "./evaluation";
import {
  buildRiskContext,
  extractDeterministicRiskSignals,
  type DeterministicRiskSignal,
  type RiskContext,
} from "./signals";
import { mergeActionProposalShadowRisk } from "@/lib/gateway/proposals/repository";
import type { RiskAssessmentInput } from "./decision-composition";
import { toRiskAssessmentInput } from "./decision-composition";
import {
  buildCompletedShadowRecord,
  buildFailedShadowRecord,
  type StoredShadowRiskRecord,
} from "./shadow-store";

export interface ShadowRiskAnalysisParams {
  organizationId: string;
  proposalId: string;
  actionHash: string;
  agentId: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  policyDecision: PolicyDecisionOutcome;
  matchedPolicyNames: string[];
}

export interface ShadowRiskAnalysisDeps {
  classifyRisk: typeof classifyRisk;
  evaluateExplainableRisk: typeof evaluateExplainableRisk;
  mergeShadowRisk: typeof mergeActionProposalShadowRisk;
  recordAudit: typeof recordRuntimeAuditEventAsync;
}

const defaultShadowDeps: ShadowRiskAnalysisDeps = {
  classifyRisk,
  evaluateExplainableRisk,
  mergeShadowRisk: mergeActionProposalShadowRisk,
  recordAudit: recordRuntimeAuditEventAsync,
};

function classifierContextFromParams(
  params: ShadowRiskAnalysisParams,
  riskContext: RiskContext,
  deterministicSignals: DeterministicRiskSignal[]
): ShadowRiskClassifierContext {
  return {
    agentId: params.agentId,
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
    policyDecision: params.policyDecision,
    matchedPolicyNames: params.matchedPolicyNames,
    riskContext,
    deterministicSignals,
  };
}

function buildShadowRiskContext(params: ShadowRiskAnalysisParams): {
  riskContext: RiskContext;
  deterministicSignals: DeterministicRiskSignal[];
} {
  const riskContext = buildRiskContext({
    agentId: params.agentId,
    toolName: params.toolName,
    actionType: params.actionType,
    payload: params.payload,
  });
  return {
    riskContext,
    deterministicSignals: extractDeterministicRiskSignals(riskContext),
  };
}

function shadowFailureCode(err: unknown): string {
  if (err instanceof ShadowRiskClassifierError) {
    return err.code;
  }
  return "unknown";
}

function shadowFailureMessage(err: unknown): string {
  if (err instanceof ShadowRiskClassifierError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Shadow risk classifier failed.";
}

function auditAssessmentStarted(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  deterministicSignals: DeterministicRiskSignal[],
  recordAudit: ShadowRiskAnalysisDeps["recordAudit"]
): void {
  recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "risk.assessment_started",
    agentId: params.agentId,
    metadata: {
      mode: "shadow",
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      deterministicSignalCount: deterministicSignals.length,
    },
  });
}

function auditAssessmentCompleted(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  assessment: ExplainableRiskAssessment,
  recordAudit: ShadowRiskAnalysisDeps["recordAudit"]
): void {
  recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "risk.assessment_completed",
    agentId: params.agentId,
    metadata: {
      mode: "shadow",
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      shadowRecommendedDecision: assessment.recommendedDecision,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.score,
      confidence: assessment.confidence,
      classifierVersion: assessment.classifierVersion,
      classifierStatus: assessment.classifierStatus,
      latencyMs: assessment.latencyMs,
      modelProvider: assessment.modelProvider,
      modelName: assessment.modelName,
      signalCodes: assessment.signalCodes,
      deterministicSignalCodes: assessment.deterministicSignalCodes,
    },
  });
}

function auditShadowSuccess(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  assessment: ExplainableRiskAssessment,
  recordAudit: ShadowRiskAnalysisDeps["recordAudit"]
): void {
  recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "shadow.risk_analyzed",
    agentId: params.agentId,
    metadata: {
      mode: "shadow",
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      shadowRecommendedDecision: assessment.recommendedDecision,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.score,
      confidence: assessment.confidence,
      classifierVersion: assessment.classifierVersion,
      classifierStatus: assessment.classifierStatus,
      latencyMs: assessment.latencyMs,
      modelProvider: assessment.modelProvider,
      modelName: assessment.modelName,
      signalCount: assessment.signals.length,
      signalCodes: assessment.signalCodes,
      deterministicSignalCodes: assessment.deterministicSignalCodes,
    },
  });
}

function auditAssessmentFailed(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  record: StoredShadowRiskRecord,
  recordAudit: ShadowRiskAnalysisDeps["recordAudit"]
): void {
  if (record.status !== "failed") {
    return;
  }

  recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "risk.assessment_failed",
    agentId: params.agentId,
    metadata: {
      mode: "shadow",
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      classifierVersion: record.classifierVersion,
      classifierStatus: record.classifierStatus,
      latencyMs: record.latencyMs,
      code: record.failure.code,
      reason: record.failure.message,
    },
  });
}

function auditShadowFailure(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  record: StoredShadowRiskRecord,
  recordAudit: ShadowRiskAnalysisDeps["recordAudit"]
): void {
  if (record.status !== "failed") {
    return;
  }

  recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: "shadow.risk_failed",
    agentId: params.agentId,
    metadata: {
      mode: "shadow",
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      classifierVersion: record.classifierVersion,
      classifierStatus: record.classifierStatus,
      latencyMs: record.latencyMs,
      code: record.failure.code,
      reason: record.failure.message,
    },
  });
}

/**
 * Runs shadow risk assessment, persists results, and returns input for decision composition.
 * Never throws — classifier failure must not break proposal creation.
 */
export async function runShadowRiskAnalysisSafely(
  supabase: SupabaseClient,
  params: ShadowRiskAnalysisParams,
  deps: Partial<ShadowRiskAnalysisDeps> = {}
): Promise<RiskAssessmentInput> {
  const resolved: ShadowRiskAnalysisDeps = {
    ...defaultShadowDeps,
    ...deps,
  };
  const startedAt = Date.now();
  const { riskContext, deterministicSignals } = buildShadowRiskContext(params);

  auditAssessmentStarted(supabase, params, deterministicSignals, resolved.recordAudit);

  try {
    const assessment = await resolved.evaluateExplainableRisk(
      classifierContextFromParams(params, riskContext, deterministicSignals),
      deterministicSignals,
      { classifyRisk: resolved.classifyRisk }
    );

    const record = buildCompletedShadowRecord({
      proposalId: params.proposalId,
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      assessment,
      deterministicSignals,
      riskContext,
    });

    if (record.actionHash !== params.actionHash || record.proposalId !== params.proposalId) {
      throw new ShadowRiskClassifierError(
        "validation_error",
        "Shadow assessment binding mismatch."
      );
    }

    await resolved.mergeShadowRisk(supabase, {
      proposalId: params.proposalId,
      organizationId: params.organizationId,
      actionHash: params.actionHash,
      shadow: record,
    });

    auditAssessmentCompleted(supabase, params, assessment, resolved.recordAudit);
    auditShadowSuccess(supabase, params, assessment, resolved.recordAudit);

    return toRiskAssessmentInput({ status: "completed", assessment });
  } catch (err) {
    const record = buildFailedShadowRecord({
      proposalId: params.proposalId,
      actionHash: params.actionHash,
      policyDecision: params.policyDecision,
      deterministicSignals,
      riskContext,
      code: shadowFailureCode(err),
      message: shadowFailureMessage(err),
      latencyMs: Date.now() - startedAt,
    });

    try {
      await resolved.mergeShadowRisk(supabase, {
        proposalId: params.proposalId,
        organizationId: params.organizationId,
        actionHash: params.actionHash,
        shadow: record,
      });
      auditAssessmentFailed(supabase, params, record, resolved.recordAudit);
      auditShadowFailure(supabase, params, record, resolved.recordAudit);
    } catch (persistErr) {
      console.error(
        "[shadow-risk] Failed to persist shadow failure record:",
        persistErr instanceof Error ? persistErr.message : persistErr
      );
    }

    return toRiskAssessmentInput({
      status: "failed",
      failureCode: shadowFailureCode(err),
    });
  }
}
