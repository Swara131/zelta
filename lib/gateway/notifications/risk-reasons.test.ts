import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractConciseRiskReasons } from "./risk-reasons";

describe("extractConciseRiskReasons", () => {
  it("combines policy and AI reasons without duplicates", () => {
    const reasons = extractConciseRiskReasons({
      matchedPolicies: [
        { name: "Large refund", decision: "REVIEW", reason: "Amount exceeds threshold" },
      ],
      ai: {
        riskReasons: ["High-value financial action", "High-value financial action"],
      },
    });

    assert.deepEqual(reasons, [
      "Large refund: Amount exceeds threshold",
      "High-value financial action",
    ]);
  });

  it("caps reason count", () => {
    const reasons = extractConciseRiskReasons({
      matchedPolicies: [],
      ai: {
        riskReasons: ["r1", "r2", "r3", "r4", "r5", "r6"],
      },
    });

    assert.equal(reasons.length, 5);
  });
});
