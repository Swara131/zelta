import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderGatewayReviewRequested } from "./render";

describe("renderGatewayReviewRequested", () => {
  it("includes review deadline, risk reasons, and approvals link without secrets", () => {
    const rendered = renderGatewayReviewRequested({
      proposalId: "44444444-4444-4444-8444-444444444444",
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      plainEnglishSummary: "Customer refund requires authorization.",
      riskLevel: "high",
      riskScore: 80,
      riskReasons: ["Large refund: Amount threshold exceeded"],
      reviewDeadline: "2026-07-10T18:00:00.000Z",
      approvalsUrl: "https://app.example.com/approvals?proposal=44444444-4444-4444-8444-444444444444",
      recipientName: "Reviewer",
    });

    assert.match(rendered.subject, /Review Required/i);
    assert.match(rendered.html, /refund-agent-01/);
    assert.match(rendered.html, /financial\.refund/);
    assert.match(rendered.html, /Amount threshold exceeded/);
    assert.match(rendered.html, /approvals\?proposal=/);
    assert.doesNotMatch(rendered.html, /et_[a-z0-9_+-]{16,}/i);
  });

  it("escapes HTML and script-like content in dynamic fields", () => {
    const rendered = renderGatewayReviewRequested({
      proposalId: "44444444-4444-4444-8444-444444444444",
      agentId: "<script>alert(1)</script>",
      toolName: "issue_refund",
      actionType: "financial.refund",
      plainEnglishSummary: '<img src=x onerror="alert(1)">',
      riskLevel: "high",
      riskScore: 80,
      riskReasons: ['<script>alert("xss")</script>'],
      reviewDeadline: "2026-07-10T18:00:00.000Z",
      approvalsUrl: "https://app.example.com/approvals?proposal=44444444-4444-4444-8444-444444444444",
      recipientName: "Reviewer<script>",
    });

    assert.doesNotMatch(rendered.html, /<script>alert/i);
    assert.match(rendered.html, /&lt;script&gt;/);
    assert.match(rendered.html, /&lt;img src=x onerror=/);
  });
});
