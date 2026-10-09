import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSafetyCheck } from "./evaluate-safety-check";

const baseInput = {
  agentId: "demo-customer-support-agent",
  agentName: "Customer Support Agent",
  customerId: "cus_12345",
  reason: "Customer requested refund for delayed shipment.",
};

describe("evaluateSafetyCheck", () => {
  it("allows small refunds automatically", () => {
    const result = evaluateSafetyCheck({
      ...baseInput,
      actionId: "issue_refund",
      amountInr: 500,
    });

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.headline, "ALLOWED AUTOMATICALLY");
    assert.equal(result.requiredApproval, false);
  });

  it("requires approval for large refunds", () => {
    const result = evaluateSafetyCheck({
      ...baseInput,
      actionId: "issue_refund",
      amountInr: 25_000,
    });

    assert.equal(result.decision, "REVIEW");
    assert.equal(result.headline, "APPROVAL REQUIRED");
    assert.equal(result.requiredApproval, true);
    assert.match(result.reason, /₹5,000/);
    assert.equal(result.amountDisplay, "₹25,000");
  });

  it("blocks destructive production deletes", () => {
    const result = evaluateSafetyCheck({
      ...baseInput,
      actionId: "delete_record",
    });

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.headline, "BLOCKED");
    assert.equal(result.requiredApproval, false);
  });

  it("marks results as demo-only", () => {
    const result = evaluateSafetyCheck({
      ...baseInput,
      actionId: "send_email",
    });

    assert.equal(result.demo, true);
    assert.ok(result.riskScore >= 0);
  });
});
