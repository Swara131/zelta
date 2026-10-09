import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFallbackAgentSpec } from "./fallback-spec";
import { slugifyAgentId } from "./slug";

describe("agent-builder fallback spec", () => {
  it("builds the customer refund example", () => {
    const spec = buildFallbackAgentSpec(
      "Email customers their refund status and issue refunds under ₹5,000 automatically."
    );

    assert.equal(spec.name, "Customer Refund Agent");
    assert.match(spec.summary, /refund/i);
    assert.ok(spec.tools.some((tool) => tool.label === "Send email"));
    assert.ok(spec.tools.some((tool) => tool.label === "Issue refund"));
    assert.ok(
      spec.protection.some(
        (rule) => rule.level === "allow" && rule.label.includes("₹5,000")
      )
    );
    assert.ok(
      spec.protection.some(
        (rule) => rule.level === "block" && rule.label.includes("Delete")
      )
    );
  });

  it("slugifies agent ids", () => {
    assert.equal(slugifyAgentId("Customer Refund Agent"), "customer-refund-agent");
  });
});
