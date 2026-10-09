import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STRUCTURED_PROTECTION_RULES,
  formatStructuredDecision,
  getDefaultStructuredProtectionConfig,
} from "./structured-rules";

describe("structured-rules", () => {
  it("provides default rules with action, condition, and decision", () => {
    const config = getDefaultStructuredProtectionConfig();

    assert.ok(config.rules.length >= 3);
    assert.ok(
      config.rules.some(
        (rule) =>
          rule.action === "Refund customer" &&
          rule.condition.includes("₹5,000") &&
          rule.decision === "ALLOW"
      )
    );
    assert.ok(
      config.rules.some(
        (rule) =>
          rule.action === "Refund customer" &&
          rule.condition.includes("Above") &&
          rule.decision === "REVIEW"
      )
    );
    assert.ok(
      config.rules.some(
        (rule) => rule.action.includes("Delete customer") && rule.decision === "BLOCK"
      )
    );
  });

  it("formats review decisions as APPROVAL in the UI", () => {
    assert.equal(formatStructuredDecision("REVIEW"), "APPROVAL");
    assert.equal(formatStructuredDecision("ALLOW"), "ALLOW");
    assert.equal(formatStructuredDecision("BLOCK"), "BLOCK");
  });

  it("includes explanations on every default rule", () => {
    for (const rule of DEFAULT_STRUCTURED_PROTECTION_RULES) {
      assert.ok(rule.explanation.trim().length > 0);
    }
  });
});
