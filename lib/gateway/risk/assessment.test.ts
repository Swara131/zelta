import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseShadowRiskAssessment,
  ShadowRiskAssessmentError,
  type ShadowRiskAssessment,
} from "./assessment";

const validBase: ShadowRiskAssessment = {
  riskLevel: "low",
  score: 12,
  confidence: 0.91,
  reasons: ["Refund amount within auto-allow threshold"],
  signals: [
    {
      code: "refund.amount.small",
      description: "Amount is below configured review threshold",
      severity: "low",
    },
  ],
  recommendedDecision: "allow",
  modelProvider: "groq",
  modelName: "llama-3.3-70b-versatile",
  classifierVersion: "shadow-v0",
};

describe("parseShadowRiskAssessment", () => {
  it("accepts a valid low-risk assessment", () => {
    const parsed = parseShadowRiskAssessment(validBase);

    assert.equal(parsed.riskLevel, "low");
    assert.equal(parsed.score, 12);
    assert.equal(parsed.recommendedDecision, "allow");
    assert.equal(parsed.signals.length, 1);
  });

  it("accepts a valid high-risk assessment", () => {
    const parsed = parseShadowRiskAssessment({
      ...validBase,
      riskLevel: "high",
      score: 82,
      confidence: 0.76,
      reasons: [
        "Large financial transfer to external account",
        "No prior approval history for this agent",
      ],
      signals: [
        {
          code: "financial.amount.elevated",
          description: "Transfer exceeds typical support limits",
          severity: "high",
        },
        {
          code: "agent.history sparse",
          description: "Limited historical activity for agent",
          severity: "medium",
        },
      ],
      recommendedDecision: "review",
    });

    assert.equal(parsed.riskLevel, "high");
    assert.equal(parsed.recommendedDecision, "review");
    assert.equal(parsed.score, 82);
  });

  it("rejects score outside 0-100", () => {
    assert.throws(
      () => parseShadowRiskAssessment({ ...validBase, score: 101 }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskAssessmentError);
        assert.ok(
          err.details.some((issue) => issue.path.join(".") === "score")
        );
        return true;
      }
    );
  });

  it("rejects confidence outside 0-1", () => {
    assert.throws(
      () => parseShadowRiskAssessment({ ...validBase, confidence: 1.01 }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskAssessmentError);
        assert.ok(
          err.details.some((issue) => issue.path.join(".") === "confidence")
        );
        return true;
      }
    );
  });

  it('rejects recommendedDecision "block"', () => {
    assert.throws(
      () =>
        parseShadowRiskAssessment({
          ...validBase,
          recommendedDecision: "block",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskAssessmentError);
        assert.ok(
          err.details.some((issue) => issue.path.join(".") === "recommendedDecision")
        );
        return true;
      }
    );
  });

  it("rejects a malformed object", () => {
    assert.throws(
      () => parseShadowRiskAssessment({ riskLevel: "low", score: "not-a-number" }),
      (err: unknown) => err instanceof ShadowRiskAssessmentError
    );

    assert.throws(
      () => parseShadowRiskAssessment(null),
      (err: unknown) => err instanceof ShadowRiskAssessmentError
    );

    assert.throws(
      () =>
        parseShadowRiskAssessment({
          ...validBase,
          extraField: "not allowed",
        }),
      (err: unknown) => err instanceof ShadowRiskAssessmentError
    );
  });
});
