import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDefaultEditableProtectionConfig } from "./protection-rules-store";

describe("protection-rules-store", () => {
  it("provides default editable rules in three sections", () => {
    const config = getDefaultEditableProtectionConfig();

    assert.equal(config.allowed.length, 3);
    assert.equal(config.askFirst.length, 3);
    assert.equal(config.blocked.length, 3);
    assert.ok(config.allowed.every((rule) => rule.id && rule.label));
    assert.ok(config.allowed.some((rule) => rule.label.includes("₹5,000")));
    assert.ok(config.askFirst.some((rule) => rule.label.includes("discount")));
    assert.ok(config.blocked.some((rule) => rule.label.includes("Delete customer")));
  });
});
