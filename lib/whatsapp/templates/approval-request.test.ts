import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderWhatsAppApprovalRequest } from "./approval-request";

describe("renderWhatsAppApprovalRequest", () => {
  it("renders an India-first approval alert with links", () => {
    const rendered = renderWhatsAppApprovalRequest({
      agentId: "refund-handler",
      toolName: "issue_refund",
      actionType: "financial.refund",
      actionPayload: {
        amount: 800_000,
        currency: "INR",
        customerName: "Priya Singh",
      },
      riskLevel: "high",
      riskScore: 72,
      approveUrl: "https://app.example.com/approve/token",
      rejectUrl: "https://app.example.com/deny/token",
      reviewUrl: "https://app.example.com/approvals?proposal=abc",
    });

    assert.match(rendered.body, /Refund Handler needs your approval/);
    assert.match(rendered.body, /Issue ₹8,000 refund\?/);
    assert.match(rendered.body, /Customer: Priya Singh/);
    assert.match(rendered.body, /Risk: HIGH \(0\.72\)/);
    assert.match(rendered.body, /Approve: https:\/\/app\.example\.com\/approve\/token/);
    assert.match(rendered.body, /Tap to approve on Wave dashboard/);
  });
});
