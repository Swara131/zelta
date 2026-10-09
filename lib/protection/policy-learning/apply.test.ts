import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDefaultStructuredProtectionConfig } from "@/lib/protection/structured-rules";
import { applyPolicyLearningSuggestion } from "./apply";

describe("applyPolicyLearningSuggestion", () => {
  it("updates refund threshold rules", () => {
    const config = getDefaultStructuredProtectionConfig();
    const updated = applyPolicyLearningSuggestion(config, {
      kind: "raise_refund_threshold",
      thresholdInr: 7_000,
    });

    const allow = updated.rules.find((rule) => rule.id === "rule-refund-allow");
    const review = updated.rules.find((rule) => rule.id === "rule-refund-review");

    assert.equal(allow?.condition, "Up to ₹7,000");
    assert.equal(review?.condition, "Above ₹7,000");
  });

  it("adds a learned auto-approve rule", () => {
    const config = getDefaultStructuredProtectionConfig();
    const updated = applyPolicyLearningSuggestion(config, {
      kind: "auto_approve_pattern",
      toolName: "send_email",
      actionLabel: "Confirm customer email",
    });

    assert.ok(
      updated.rules.some(
        (rule) =>
          rule.decision === "ALLOW" &&
          rule.action === "Confirm customer email" &&
          rule.condition.includes("Learned")
      )
    );
  });
});
