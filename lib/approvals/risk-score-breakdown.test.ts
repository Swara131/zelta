import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRiskScoreBreakdown,
  formatRiskFactorDelta,
  riskScoreBandFromNormalized,
  riskScoreSectionTitle,
} from "./risk-score-breakdown";

describe("risk-score-breakdown", () => {
  it("maps normalized scores to risk bands", () => {
    assert.equal(riskScoreBandFromNormalized(0.15), "LOW");
    assert.equal(riskScoreBandFromNormalized(0.55), "MEDIUM");
    assert.equal(riskScoreBandFromNormalized(0.72), "HIGH");
    assert.equal(riskScoreBandFromNormalized(0.91), "CRITICAL");
  });

  it("builds weighted factors from stored Grok output", () => {
    const breakdown = buildRiskScoreBreakdown({
      riskScore: 72,
      riskReasons: {
        matchedPolicies: [],
        grok: {
          riskScore: 0.72,
          reason: "High refund amount with new customer signals",
          factors: [
            { label: "Amount exceeds ₹5,000 threshold", weight: 0.4, direction: "increase" },
            { label: "Customer account created 3 days ago", weight: 0.2, direction: "increase" },
            { label: "Customer has 4.8⭐ rating", weight: 0.02, direction: "decrease" },
          ],
        },
      },
    });

    assert.ok(breakdown);
    assert.equal(breakdown!.scoreDisplay, "0.72 (HIGH)");
    assert.equal(breakdown!.sectionTitle, "WHY WAS THIS SCORED HIGH?");
    assert.equal(breakdown!.factors.length, 3);
    assert.equal(breakdown!.hasWeightedFactors, true);
    assert.equal(
      formatRiskFactorDelta(breakdown!.factors[0]),
      "(+0.40)"
    );
    assert.equal(
      formatRiskFactorDelta(breakdown!.factors[2]),
      "(-0.02)"
    );
  });

  it("falls back to unweighted policy and AI reasons when Grok factors are missing", () => {
    const breakdown = buildRiskScoreBreakdown({
      riskScore: 55,
      matchedPolicies: [
        {
          policyId: "refund-large",
          name: "Large INR refund requires review",
          decision: "REVIEW",
          reason: "Refunds above 5000 INR require human review.",
        },
      ],
      aiRiskReasons: ["Refund amount is unusually high for this customer segment."],
    });

    assert.ok(breakdown);
    assert.equal(breakdown!.scoreDisplay, "0.55 (MEDIUM)");
    assert.equal(breakdown!.sectionTitle, riskScoreSectionTitle("MEDIUM"));
    assert.equal(breakdown!.hasWeightedFactors, false);
    assert.equal(breakdown!.factors.length, 2);
    assert.equal(formatRiskFactorDelta(breakdown!.factors[0]), null);
  });

  it("returns null when no real score exists", () => {
    const breakdown = buildRiskScoreBreakdown({
      riskSeverity: "high",
    });

    assert.equal(breakdown, null);
  });
});
