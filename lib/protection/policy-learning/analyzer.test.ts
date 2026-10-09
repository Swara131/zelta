import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildActionPatternStats,
  buildRefundApprovalBuckets,
} from "./analyzer";
import { buildPolicyLearningSuggestions } from "./suggestions";

function refund(status: string, amountMajor: number) {
  return {
    toolName: "issue_refund",
    actionType: "financial.refund",
    actionPayload: { amount: amountMajor * 100, currency: "INR" },
    status,
  };
}

describe("policy-learning analyzer", () => {
  it("builds refund approval buckets from finalized proposals", () => {
    const buckets = buildRefundApprovalBuckets({
      thresholdInr: 5_000,
      records: [
        refund("allowed", 3_000),
        refund("approved", 4_000),
        refund("rejected", 4_500),
        refund("approved", 6_000),
        refund("approved", 7_500),
        refund("rejected", 8_000),
        refund("rejected", 12_000),
        refund("rejected", 15_000),
      ],
    });

    const under = buckets.find((bucket) => bucket.id === "under_threshold");
    const mid = buckets.find((bucket) => bucket.id === "mid_range");
    const over = buckets.find((bucket) => bucket.id === "over_high");

    assert.equal(under?.approvalRatePercent, 67);
    assert.equal(mid?.approvalRatePercent, 67);
    assert.equal(over?.approvalRatePercent, 0);
  });

  it("suggests raising threshold when mid-band approvals are high", () => {
    const records = [
      ...Array.from({ length: 9 }, () => refund("approved", 6_000)),
      refund("rejected", 7_000),
      refund("allowed", 2_000),
    ];

    const buckets = buildRefundApprovalBuckets({ thresholdInr: 5_000, records });
    const patterns = buildActionPatternStats([
      ...records,
      {
        toolName: "send_email",
        actionType: "communication.email",
        actionPayload: {},
        status: "approved",
        plainEnglishSummary: "Confirm customer email",
      },
      ...Array.from({ length: 9 }, () => ({
        toolName: "send_email",
        actionType: "communication.email",
        actionPayload: {},
        status: "approved" as const,
      })),
    ]);

    const suggestions = buildPolicyLearningSuggestions({
      currentThresholdInr: 5_000,
      refundBuckets: buckets,
      actionPatterns: patterns,
    });

    assert.ok(suggestions.some((item) => item.kind === "raise_refund_threshold"));
    assert.ok(suggestions.some((item) => item.kind === "auto_approve_pattern"));
  });
});
