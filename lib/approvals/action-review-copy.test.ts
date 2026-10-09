import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PendingApproval } from "@/lib/approval-types";
import {
  buildActionReviewView,
  describeActionIntent,
  describeWhyPaused,
} from "./action-review-copy";

function buildRefundApproval(
  overrides: Partial<PendingApproval> = {}
): PendingApproval {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    title: "issue_refund — financial.refund",
    agentId: "customer-support-agent",
    riskSeverity: "medium",
    priority: "p3",
    aiExplanation: "The agent intends to refund a cancelled order.",
    businessJustification: "",
    affectedSystems: [],
    affectedUsers: [],
    complianceImpact: "",
    recommendedAction: "",
    confidenceScore: 72,
    timeline: [],
    history: [],
    submittedAt: new Date().toISOString(),
    slaDeadline: new Date().toISOString(),
    assignee: "Unassigned",
    requester: "customer-support-agent",
    source: "gateway",
    toolName: "issue_refund",
    actionType: "financial.refund",
    actionPayload: {
      customerName: "Rahul Sharma",
      amount: 1_500_000,
      currency: "INR",
      reason: "Customer requested a refund for a cancelled order.",
    },
    matchedPolicies: [
      {
        policyId: "demo-refund-review-large",
        name: "Large INR refund requires review",
        decision: "REVIEW",
        reason: "Refunds above 5000 INR require human review.",
      },
    ],
    gatewayDecision: "REVIEW",
    ...overrides,
  };
}

describe("action-review-copy", () => {
  it("describes a refund action in plain language", () => {
    const approval = buildRefundApproval();
    assert.equal(describeActionIntent(approval), "Issue a ₹15,000 refund");
    assert.match(describeWhyPaused(approval), /₹5,000/);
  });

  it("builds the action review view for founders", () => {
    const view = buildActionReviewView(buildRefundApproval());

    assert.equal(view.agentName, "Customer Support Agent");
    assert.equal(view.categoryLabel, "REFUND REQUEST");
    assert.equal(view.actionIntent, "Issue a ₹15,000 refund");
    assert.equal(view.headline, "Customer Support Agent wants to issue a refund");
    assert.equal(view.actionWants, "Wants to refund ₹15,000");
    assert.equal(view.customer, "Rahul Sharma");
    assert.equal(view.reason, "Customer requested a refund for a cancelled order.");
    assert.equal(view.riskLabel, "High");
    assert.equal(view.policySummary, "Refunds above ₹5,000 require approval");
    assert.equal(view.statusLabel, "Waiting for your decision");
    assert.equal(view.protectionLabel, "Human approval required");
    assert.match(view.whyApprovalRequired, /₹5,000/);
    assert.match(view.requestedAt, /,/);
    assert.match(view.expiresAt, /,/);
  });

  it("shows customer id when provided in payload", () => {
    const view = buildActionReviewView(
      buildRefundApproval({
        actionPayload: {
          customerId: "CUST-1042",
          amount: 2_500_000,
          currency: "INR",
          reason: "Customer requested a refund",
        },
      })
    );

    assert.equal(view.customerId, "CUST-1042");
    assert.equal(view.amount, "₹25,000");
    assert.equal(view.riskLabel, "High");
  });
});
