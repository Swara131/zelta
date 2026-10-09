import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decisionFromRiskScore,
  mergePolicyDecisions,
  parseGrokRiskScorePayload,
  riskScoreToStoredInteger,
  toPolicyDecision,
} from "@/lib/xai/score-action-risk";
import { applyGrokRiskToPolicyDecision } from "@/lib/gateway/proposals/risk-scoring";

describe("decisionFromRiskScore", () => {
  it("maps score bands to ALLOW, APPROVAL_REQUIRED, and BLOCK", () => {
    assert.equal(decisionFromRiskScore(0.1), "ALLOW");
    assert.equal(decisionFromRiskScore(0.29), "ALLOW");
    assert.equal(decisionFromRiskScore(0.3), "APPROVAL_REQUIRED");
    assert.equal(decisionFromRiskScore(0.8), "APPROVAL_REQUIRED");
    assert.equal(decisionFromRiskScore(0.81), "BLOCK");
    assert.equal(decisionFromRiskScore(1), "BLOCK");
  });
});

describe("parseGrokRiskScorePayload", () => {
  it("accepts valid Grok risk JSON", () => {
    const parsed = parseGrokRiskScorePayload({
      risk_score: 0.82,
      reason: "high amount for refund",
    });

    assert.equal(parsed.risk_score, 0.82);
    assert.equal(parsed.reason, "high amount for refund");
    assert.deepEqual(parsed.factors, []);
  });

  it("parses explainable risk factors", () => {
    const parsed = parseGrokRiskScorePayload({
      risk_score: 0.72,
      reason: "high amount for refund",
      factors: [
        { label: "Amount exceeds ₹5,000 threshold", weight: 0.4, direction: "increase" },
        { label: "Customer has 4.8⭐ rating", weight: 0.02, direction: "decrease" },
      ],
    });

    assert.equal(parsed.factors.length, 2);
    assert.equal(parsed.factors[0]?.label, "Amount exceeds ₹5,000 threshold");
    assert.equal(parsed.factors[1]?.direction, "decrease");
  });
});

describe("applyGrokRiskToPolicyDecision", () => {
  it("escalates ALLOW to REVIEW when Grok requires approval", () => {
    const result = applyGrokRiskToPolicyDecision({
      deterministicDecision: "ALLOW",
      grokRisk: {
        ok: true,
        data: {
          risk_score: 0.55,
          reason: "moderate refund amount",
          factors: [],
          decision: "APPROVAL_REQUIRED",
          policyDecision: toPolicyDecision("APPROVAL_REQUIRED"),
          model: "grok-2",
        },
      },
    });

    assert.equal(result.decision, "REVIEW");
    assert.equal(result.riskScore, 55);
    assert.equal(result.riskLevel, "medium");
  });

  it("escalates ALLOW to BLOCK for high Grok scores", () => {
    const result = applyGrokRiskToPolicyDecision({
      deterministicDecision: "ALLOW",
      grokRisk: {
        ok: true,
        data: {
          risk_score: 0.91,
          reason: "very high amount",
          factors: [],
          decision: "BLOCK",
          policyDecision: "BLOCK",
          model: "grok-2",
        },
      },
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(riskScoreToStoredInteger(0.91), 91);
  });

  it("keeps deterministic BLOCK when Grok says ALLOW", () => {
    const result = applyGrokRiskToPolicyDecision({
      deterministicDecision: "BLOCK",
      grokRisk: {
        ok: true,
        data: {
          risk_score: 0.1,
          reason: "low risk",
          factors: [],
          decision: "ALLOW",
          policyDecision: "ALLOW",
          model: "grok-2",
        },
      },
    });

    assert.equal(result.decision, "BLOCK");
  });

  it("falls back to deterministic policy when Grok fails", () => {
    const result = applyGrokRiskToPolicyDecision({
      deterministicDecision: "ALLOW",
      grokRisk: {
        ok: false,
        error: "Service temporarily unavailable. Please try again.",
      },
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.riskScore, undefined);
  });
});

describe("mergePolicyDecisions", () => {
  it("uses the stricter of two decisions", () => {
    assert.equal(mergePolicyDecisions("ALLOW", "REVIEW"), "REVIEW");
    assert.equal(mergePolicyDecisions("REVIEW", "BLOCK"), "BLOCK");
    assert.equal(mergePolicyDecisions("BLOCK", "ALLOW"), "BLOCK");
  });
});
