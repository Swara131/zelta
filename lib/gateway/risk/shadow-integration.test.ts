import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExplainableRiskAssessment } from "./assessment";
import {
  ShadowRiskClassifierError,
  SHADOW_CLASSIFIER_PROVIDER,
  SHADOW_CLASSIFIER_VERSION,
} from "./classifier";
import { mergeExplainableAssessment } from "./evaluation";
import { SHADOW_RISK_MODE } from "./shadow-store";
import { runShadowRiskAnalysisSafely } from "./shadow-integration";

describe("runShadowRiskAnalysisSafely", () => {
  it("persists explainable assessment with latency and audit lifecycle events", async () => {
    let merged: unknown = null;
    const auditEvents: string[] = [];

    await runShadowRiskAnalysisSafely(
      {} as SupabaseClient,
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        proposalId: "44444444-4444-4444-8444-444444444444",
        actionHash: "hash-abc",
        agentId: "agent-1",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 100, currency: "USD" },
        policyDecision: "ALLOW",
        matchedPolicyNames: ["Small refund"],
      },
      {
        evaluateExplainableRisk: async (_context, deterministicSignals) =>
          mergeExplainableAssessment(
            deterministicSignals,
            {
              riskLevel: "low",
              score: 20,
              confidence: 0.9,
              reasons: ["Routine refund"],
              signals: [
                {
                  code: "contextual.refund.routine",
                  description: "Routine refund",
                  severity: "low",
                },
              ],
              recommendedDecision: "allow",
              modelProvider: SHADOW_CLASSIFIER_PROVIDER,
              modelName: "test-model",
              classifierVersion: SHADOW_CLASSIFIER_VERSION,
            },
            88
          ),
        mergeShadowRisk: async (_supabase, params) => {
          merged = params;
        },
        recordAudit: (_supabase, params) => {
          auditEvents.push(params.event);
        },
      }
    );

    assert.ok(merged);
    const params = merged as {
      actionHash: string;
      shadow: {
        mode: string;
        status: string;
        classifierStatus: string;
        latencyMs: number;
        assessment: ExplainableRiskAssessment;
      };
    };
    assert.equal(params.actionHash, "hash-abc");
    assert.equal(params.shadow.mode, SHADOW_RISK_MODE);
    assert.equal(params.shadow.status, "completed");
    assert.equal(params.shadow.classifierStatus, "completed");
    assert.equal(params.shadow.latencyMs, 88);
    assert.ok(params.shadow.assessment.signalCodes.length > 0);
    assert.deepEqual(auditEvents, [
      "risk.assessment_started",
      "risk.assessment_completed",
      "shadow.risk_analyzed",
    ]);
  });

  it("returns completed risk assessment input for decision composition", async () => {
    const input = await runShadowRiskAnalysisSafely(
      {} as SupabaseClient,
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        proposalId: "44444444-4444-4444-8444-444444444444",
        actionHash: "hash-abc",
        agentId: "agent-1",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 100 },
        policyDecision: "ALLOW",
        matchedPolicyNames: [],
      },
      {
        evaluateExplainableRisk: async (_context, deterministicSignals) =>
          mergeExplainableAssessment(
            deterministicSignals,
            {
              riskLevel: "high",
              score: 80,
              confidence: 0.85,
              reasons: ["Elevated risk"],
              signals: [],
              recommendedDecision: "review",
              modelProvider: SHADOW_CLASSIFIER_PROVIDER,
              modelName: "test-model",
              classifierVersion: SHADOW_CLASSIFIER_VERSION,
            },
            42
          ),
        mergeShadowRisk: async () => {},
        recordAudit: () => {},
      }
    );

    assert.equal(input.status, "completed");
    assert.ok(input.assessment);
    assert.equal(input.assessment!.riskLevel, "high");
  });

  it("persists failure record with latency and failure audit events", async () => {
    let merged: unknown = null;
    const auditEvents: string[] = [];

    const input = await runShadowRiskAnalysisSafely(
      {} as SupabaseClient,
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        proposalId: "44444444-4444-4444-8444-444444444444",
        actionHash: "hash-abc",
        agentId: "agent-1",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 100 },
        policyDecision: "REVIEW",
        matchedPolicyNames: [],
      },
      {
        evaluateExplainableRisk: async () => {
          throw new ShadowRiskClassifierError("timeout", "timed out");
        },
        mergeShadowRisk: async (_supabase, params) => {
          merged = params;
        },
        recordAudit: (_supabase, params) => {
          auditEvents.push(params.event);
        },
      }
    );

    const params = merged as {
      shadow: {
        status: string;
        classifierStatus: string;
        latencyMs: number;
        failure?: { code: string };
      };
    };
    assert.equal(params.shadow.status, "failed");
    assert.equal(params.shadow.classifierStatus, "failed");
    assert.equal(params.shadow.failure?.code, "timeout");
    assert.ok(params.shadow.latencyMs >= 0);
    assert.deepEqual(auditEvents, [
      "risk.assessment_started",
      "risk.assessment_failed",
      "shadow.risk_failed",
    ]);
    assert.equal(input.status, "failed");
    assert.equal(input.failureCode, "timeout");
  });
});
