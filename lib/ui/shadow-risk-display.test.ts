import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHADOW_CLASSIFIER_PROVIDER, SHADOW_CLASSIFIER_VERSION } from "@/lib/gateway/risk/classifier";
import { mergeExplainableAssessment } from "@/lib/gateway/risk/evaluation";
import { buildRiskContext, extractDeterministicRiskSignals } from "@/lib/gateway/risk/signals";
import { SHADOW_RISK_MODE } from "@/lib/gateway/risk/shadow-store";
import { mapReviewProposalToPendingApproval } from "@/lib/gateway/proposals/review-mapper";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import {
  buildAuditRiskAssessmentDescription,
  formatSignalCodeLabel,
  isRiskAssessmentRuntimeEvent,
  mapShadowRiskDisplay,
} from "./shadow-risk-display";

function buildCompletedShadowRiskReasons() {
  const deterministicSignals = extractDeterministicRiskSignals(
    buildRiskContext({
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR" },
    })
  );

  const assessment = mergeExplainableAssessment(
    deterministicSignals,
    {
      riskLevel: "low",
      score: 12,
      confidence: 0.9,
      reasons: ["Small INR refund within auto-allow range"],
      signals: [
        {
          code: "contextual.refund.routine",
          description: "Routine support refund pattern",
          severity: "low",
        },
      ],
      recommendedDecision: "allow",
      modelProvider: SHADOW_CLASSIFIER_PROVIDER,
      modelName: "test-model",
      classifierVersion: SHADOW_CLASSIFIER_VERSION,
    },
    95
  );

  return {
    matchedPolicies: [],
    shadow: {
      mode: SHADOW_RISK_MODE,
      status: "completed" as const,
      proposalId: "44444444-4444-4444-8444-444444444444",
      actionHash: "hash-abc",
      classifierVersion: SHADOW_CLASSIFIER_VERSION,
      classifierStatus: "completed" as const,
      latencyMs: 95,
      assessedAt: new Date().toISOString(),
      policyDecision: "REVIEW" as const,
      deterministicSignals,
      riskContext: {},
      assessment,
    },
  };
}

describe("mapShadowRiskDisplay", () => {
  it("returns pending when no shadow record exists", () => {
    const view = mapShadowRiskDisplay({ matchedPolicies: [] }, "review");

    assert.equal(view.status, "pending");
    assert.equal(view.gatewayDecision, "REVIEW");
    assert.equal(view.shadowRecommendedDecision, null);
  });

  it("maps completed shadow assessments for UI display", () => {
    const view = mapShadowRiskDisplay(buildCompletedShadowRiskReasons(), "review");

    assert.equal(view.status, "completed");
    assert.equal(view.mode, "shadow");
    assert.equal(view.gatewayDecision, "REVIEW");
    assert.equal(view.shadowRecommendedDecision, "ALLOW");
    assert.equal(view.riskLevel, "low");
    assert.equal(view.score, 12);
    assert.equal(view.confidence, 0.9);
    assert.ok(view.reasons.length > 0);
    assert.ok(view.signalLabels.length > 0);
    assert.equal(view.classifierStatus, "completed");
    assert.equal(view.latencyMs, 95);
  });

  it("maps failed shadow assessments without inventing scores", () => {
    const view = mapShadowRiskDisplay(
      {
        matchedPolicies: [],
        shadow: {
          mode: SHADOW_RISK_MODE,
          status: "failed",
          proposalId: "44444444-4444-4444-8444-444444444444",
          actionHash: "hash-abc",
          classifierVersion: SHADOW_CLASSIFIER_VERSION,
          classifierStatus: "failed",
          latencyMs: 40,
          assessedAt: new Date().toISOString(),
          policyDecision: "REVIEW",
          deterministicSignals: [],
          riskContext: {},
          failure: { code: "timeout", message: "Shadow classifier timed out." },
        },
      },
      "review"
    );

    assert.equal(view.status, "failed");
    assert.equal(view.score, null);
    assert.equal(view.confidence, null);
    assert.equal(view.failureCode, "timeout");
    assert.equal(view.shadowRecommendedDecision, null);
  });

  it("does not expose raw risk context or secrets", () => {
    const view = mapShadowRiskDisplay(buildCompletedShadowRiskReasons(), "review");
    const serialized = JSON.stringify(view);

    assert.equal(serialized.includes("riskContext"), false);
    assert.equal(serialized.includes("apiKey"), false);
    assert.equal(serialized.includes("executionToken"), false);
  });
});

describe("formatSignalCodeLabel", () => {
  it("formats machine codes into readable labels", () => {
    assert.equal(formatSignalCodeLabel("financial.amount.present"), "Financial Amount Present");
    assert.equal(formatSignalCodeLabel("contextual.refund.elevated_amount"), "Refund Elevated Amount");
  });
});

describe("buildAuditRiskAssessmentDescription", () => {
  it("describes completed assessments with gateway vs shadow distinction", () => {
    const description = buildAuditRiskAssessmentDescription({
      event: "risk.assessment_completed",
      mode: "shadow",
      policyDecision: "REVIEW",
      riskLevel: "high",
      riskScore: 78,
      shadowRecommendedDecision: "review",
      latencyMs: 110,
    });

    assert.ok(description.includes("Shadow assessment completed"));
    assert.ok(description.includes("level high"));
    assert.ok(description.includes("shadow recommends REVIEW"));
    assert.ok(description.includes("gateway REVIEW"));
  });

  it("describes failed assessments safely", () => {
    const description = buildAuditRiskAssessmentDescription({
      event: "risk.assessment_failed",
      mode: "shadow",
      code: "timeout",
      latencyMs: 40,
    });

    assert.ok(description.includes("failed"));
    assert.ok(description.includes("timeout"));
  });
});

describe("isRiskAssessmentRuntimeEvent", () => {
  it("detects risk assessment timeline events", () => {
    assert.equal(isRiskAssessmentRuntimeEvent("risk.assessment_completed"), true);
    assert.equal(isRiskAssessmentRuntimeEvent("shadow.risk_analyzed"), true);
    assert.equal(isRiskAssessmentRuntimeEvent("policy.review"), false);
  });
});

describe("mapReviewProposalToPendingApproval", () => {
  it("includes shadow risk display on gateway approval cards", () => {
    const row: ActionProposalRow = {
      id: "44444444-4444-4444-8444-444444444444",
      organization_id: "11111111-1111-4111-8111-111111111111",
      agent_id: "refund-agent-01",
      tool_name: "issue_refund",
      action_type: "financial.refund",
      action_payload: { amount: 50_000, currency: "INR" },
      action_hash: "hash-abc",
      plain_english_summary: "Refund request",
      risk_level: "medium",
      risk_score: 20,
      risk_reasons: buildCompletedShadowRiskReasons(),
      policy_decision: "review",
      status: "review_required",
      requested_by: null,
      idempotency_key: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      review_expires_at: new Date(Date.now() + 30_000).toISOString(),
      decided_at: new Date().toISOString(),
      executed_at: null,
    };

    const approval = mapReviewProposalToPendingApproval(row);

    assert.equal(approval.gatewayDecision, "REVIEW");
    assert.ok(approval.shadowRisk);
    assert.equal(approval.shadowRisk!.status, "completed");
    assert.equal(approval.shadowRisk!.gatewayDecision, "REVIEW");
    assert.equal(approval.shadowRisk!.shadowRecommendedDecision, "ALLOW");
  });
});
