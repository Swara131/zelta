import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHADOW_CLASSIFIER_PROVIDER, SHADOW_CLASSIFIER_VERSION } from "./classifier";
import {
  applyRecommendationGuardrails,
  buildExampleExplainableAssessment,
  mergeExplainableAssessment,
  sanitizeAssessmentReasons,
} from "./evaluation";
import {
  buildRiskContext,
  extractDeterministicRiskSignals,
} from "./signals";

const providerMeta = {
  modelProvider: SHADOW_CLASSIFIER_PROVIDER,
  modelName: "test-model",
  classifierVersion: SHADOW_CLASSIFIER_VERSION,
};

describe("mergeExplainableAssessment", () => {
  it("combines deterministic facts with contextual interpretation", () => {
    const riskContext = buildRiskContext({
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR", customerId: "cus_123" },
    });
    const deterministicSignals = extractDeterministicRiskSignals(riskContext);

    const assessment = mergeExplainableAssessment(
      deterministicSignals,
      {
        riskLevel: "low",
        score: 15,
        confidence: 0.9,
        reasons: ["Small refund within typical limits"],
        signals: [
          {
            code: "refund.pattern.normal",
            description: "Refund pattern matches routine support activity",
            severity: "low",
          },
        ],
        recommendedDecision: "allow",
        ...providerMeta,
      },
      95
    );

    assert.equal(assessment.riskLevel, "low");
    assert.equal(assessment.recommendedDecision, "allow");
    assert.equal(assessment.classifierStatus, "completed");
    assert.equal(assessment.latencyMs, 95);
    assert.ok(assessment.deterministicSignalCodes.includes("financial.amount.present"));
    assert.ok(assessment.signalCodes.includes("contextual.refund.pattern.normal"));
    assert.ok(
      assessment.signals.some(
        (signal) => signal.source === "deterministic" && signal.code === "agent.identity"
      )
    );
    assert.ok(
      assessment.signals.some(
        (signal) => signal.source === "contextual" && signal.code === "contextual.refund.pattern.normal"
      )
    );
  });

  it("drops duplicate deterministic codes from contextual signals", () => {
    const deterministicSignals = extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "agent-1",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 50_000, currency: "INR" },
      })
    );

    const assessment = mergeExplainableAssessment(
      deterministicSignals,
      {
        riskLevel: "medium",
        score: 40,
        confidence: 0.8,
        reasons: ["Review suggested"],
        signals: [
          {
            code: "financial.amount.present",
            description: "LLM attempted to restate deterministic fact",
            severity: "medium",
          },
          {
            code: "contextual.anomaly",
            description: "Unusual timing pattern",
            severity: "medium",
          },
        ],
        recommendedDecision: "review",
        ...providerMeta,
      },
      80
    );

    const contextualCodes = assessment.contextualSignals.map((signal) => signal.code);
    assert.equal(contextualCodes.includes("financial.amount.present"), false);
    assert.ok(contextualCodes.includes("contextual.anomaly"));
  });

  it("forces REVIEW for critical risk even when LLM says allow", () => {
    const deterministicSignals = extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "ops-agent",
        toolName: "delete_database",
        actionType: "database.delete",
        payload: {
          destructiveOperation: true,
          productionTarget: true,
          resourceType: "database",
        },
      })
    );

    const assessment = mergeExplainableAssessment(
      deterministicSignals,
      {
        riskLevel: "critical",
        score: 95,
        confidence: 0.88,
        reasons: ["Destructive production database operation"],
        signals: [
          {
            code: "contextual.destructive.prod",
            description: "Production destructive action requires human oversight",
            severity: "high",
          },
        ],
        recommendedDecision: "allow",
        ...providerMeta,
      },
      110
    );

    assert.equal(assessment.recommendedDecision, "review");
    assert.equal(assessment.riskLevel, "critical");
  });

  it("forces REVIEW for high uncertainty", () => {
    const decision = applyRecommendationGuardrails({
      riskLevel: "medium",
      score: 45,
      confidence: 0.3,
      recommendedDecision: "allow",
    });

    assert.equal(decision, "review");
  });

  it("forces REVIEW for high score", () => {
    const decision = applyRecommendationGuardrails({
      riskLevel: "medium",
      score: 82,
      confidence: 0.9,
      recommendedDecision: "allow",
    });

    assert.equal(decision, "review");
  });

  it("sanitizes chain-of-thought from reasons", () => {
    const reasons = sanitizeAssessmentReasons([
      "Large refund amount exceeds typical support limits",
      "Step 1: analyze the payload and compare thresholds",
      "First, I need to consider prior agent behavior",
    ]);

    assert.equal(reasons.length, 1);
    assert.equal(reasons[0], "Large refund amount exceeds typical support limits");
  });
});

describe("example explainable assessments", () => {
  it("low-risk refund", () => {
    const deterministicSignals = extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 50_000, currency: "INR", customerId: "cus_123" },
      })
    );

    const assessment = buildExampleExplainableAssessment({
      deterministicSignals,
      contextualAssessment: {
        riskLevel: "low",
        score: 12,
        confidence: 0.92,
        reasons: ["Small INR refund within auto-allow range"],
        signals: [
          {
            code: "contextual.refund.routine",
            description: "Routine support refund pattern",
            severity: "low",
          },
        ],
        recommendedDecision: "allow",
        ...providerMeta,
      },
    });

    assert.equal(assessment.riskLevel, "low");
    assert.equal(assessment.recommendedDecision, "allow");
    assert.ok(assessment.signalCodes.includes("operation.reversible"));
  });

  it("suspicious high-value refund", () => {
    const deterministicSignals = extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: {
          amount: 2_500_000,
          currency: "INR",
          customerId: "cus_999",
          isNewDestination: true,
        },
      })
    );

    const assessment = buildExampleExplainableAssessment({
      deterministicSignals,
      contextualAssessment: {
        riskLevel: "high",
        score: 78,
        confidence: 0.71,
        reasons: [
          "High-value refund to a new destination warrants human review",
          "Amount significantly above typical auto-allow threshold",
        ],
        signals: [
          {
            code: "contextual.refund.elevated_amount",
            description: "Refund amount is unusually high for this agent",
            severity: "high",
          },
        ],
        recommendedDecision: "review",
        ...providerMeta,
      },
    });

    assert.equal(assessment.riskLevel, "high");
    assert.equal(assessment.recommendedDecision, "review");
    assert.ok(assessment.signalCodes.includes("destination.new_or_unknown"));
    assert.ok(assessment.signalCodes.includes("contextual.refund.elevated_amount"));
  });

  it("destructive production action", () => {
    const deterministicSignals = extractDeterministicRiskSignals(
      buildRiskContext({
        agentId: "ops-agent",
        toolName: "delete_database",
        actionType: "database.delete",
        payload: {
          resourceType: "database",
          destructiveOperation: true,
          productionTarget: true,
          environment: "production",
        },
      })
    );

    const assessment = buildExampleExplainableAssessment({
      deterministicSignals,
      contextualAssessment: {
        riskLevel: "critical",
        score: 97,
        confidence: 0.94,
        reasons: [
          "Irreversible destructive operation against production infrastructure",
          "Shadow advisory recommends human review before any execution",
        ],
        signals: [
          {
            code: "contextual.destructive.production",
            description: "Production destructive action with irreversible impact",
            severity: "high",
          },
        ],
        recommendedDecision: "review",
        ...providerMeta,
      },
    });

    assert.equal(assessment.riskLevel, "critical");
    assert.equal(assessment.recommendedDecision, "review");
    assert.ok(assessment.signalCodes.includes("operation.destructive"));
    assert.ok(assessment.signalCodes.includes("environment.production"));
    assert.ok(assessment.signalCodes.includes("operation.irreversible"));
  });
});
