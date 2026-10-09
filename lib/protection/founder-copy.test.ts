import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFounderProtectionRules,
  getHowProtectionWorksCards,
  getLargeRefundThresholdLabel,
  getQuickProtectionSettings,
} from "./founder-copy";

describe("protection founder-copy", () => {
  it("describes allow, review, and block", () => {
    const cards = getHowProtectionWorksCards();
    assert.equal(cards.length, 3);
    assert.ok(cards.some((card) => card.decision === "ALLOW"));
    assert.ok(cards.some((card) => card.decision === "REVIEW"));
    assert.ok(cards.some((card) => card.decision === "BLOCK"));
  });

  it("maps demo policies to founder rules", () => {
    const rules = getFounderProtectionRules();
    assert.ok(rules.length >= 3);
    const largeRefund = rules.find((rule) => rule.id === "demo-refund-review-large");
    assert.ok(largeRefund);
    assert.equal(largeRefund?.decisionLabel, "Require approval");
    assert.ok(largeRefund?.whenItApplies.includes("₹"));
  });

  it("derives quick settings from demo policies", () => {
    const settings = getQuickProtectionSettings();
    assert.equal(settings.length, 4);
    assert.ok(settings.every((setting) => setting.active));
  });

  it("formats refund threshold from policy data", () => {
    assert.equal(getLargeRefundThresholdLabel(), "₹5,000");
  });
});
