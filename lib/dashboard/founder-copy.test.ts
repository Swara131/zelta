import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAgentCards,
  computeProtectionToday,
  computeSafetySummary,
  describeApprovalHeadline,
  describeApprovalReason,
  getTimeGreeting,
  humanizeAgentLabel,
} from "./founder-copy";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";

function samplePendingApproval(
  overrides: Partial<PendingApproval> = {}
): PendingApproval {
  return {
    id: "approval-1",
    title: "issue_refund — financial.refund",
    agentId: "customer-support-agent",
    riskSeverity: "high",
    priority: "p2",
    aiExplanation: "Refunds above 5000 INR require human review.",
    businessJustification: "Customer requested a refund.",
    affectedSystems: ["billing"],
    affectedUsers: ["customer"],
    complianceImpact: "Financial controls apply to high-value refunds.",
    recommendedAction: "Review the amount and approve or reject.",
    confidenceScore: 80,
    timeline: [],
    history: [],
    submittedAt: "2026-01-01T10:00:00.000Z",
    slaDeadline: "2026-01-01T12:00:00.000Z",
    assignee: "founder",
    requester: "customer-support-agent",
    source: "gateway",
    toolName: "issue_refund",
    actionType: "financial.refund",
    actionPayload: { amount: 1_500_000, currency: "INR" },
    matchedPolicies: [
      {
        policyId: "demo-refund-review-large",
        name: "Large INR refund requires review",
        decision: "REVIEW",
        reason: "Refunds above 5000 INR require human review.",
      },
    ],
    ...overrides,
  };
}

describe("founder dashboard copy", () => {
  it("greets by time of day", () => {
    assert.equal(getTimeGreeting(new Date("2026-01-01T09:00:00")), "Good morning");
    assert.equal(getTimeGreeting(new Date("2026-01-01T15:00:00")), "Good afternoon");
    assert.equal(getTimeGreeting(new Date("2026-01-01T20:00:00")), "Good evening");
  });

  it("humanizes agent ids", () => {
    assert.equal(
      humanizeAgentLabel("customer-support-agent"),
      "Customer Support Agent"
    );
  });

  it("describes refund approvals in plain language", () => {
    const approval = samplePendingApproval({ id: "1" });

    assert.match(
      describeApprovalHeadline(approval),
      /Customer Support Agent wants to issue a .* refund/
    );
    assert.match(describeApprovalReason(approval), /5000 INR/);
  });

  it("computes safety summary from audit entries", () => {
    const now = new Date("2026-01-01T12:00:00");
    const entries: AuditTimelineEntry[] = [
      {
        id: "1",
        action: "create",
        title: "Checked",
        description: "Checked",
        timestamp: "2026-01-01T10:00:00.000Z",
        actor: "agent",
        actorEmail: null,
        risk: null,
        approvalStatus: null,
        ipAddress: null,
        userAgent: null,
        entityType: "action_proposal",
        entityId: null,
        metadata: {},
        runtimeEvent: "proposal.created",
        source: "runtime",
      },
      {
        id: "2",
        action: "update",
        title: "Risky",
        description: "Risky",
        timestamp: "2026-01-01T11:00:00.000Z",
        actor: "agent",
        actorEmail: null,
        risk: null,
        approvalStatus: "pending",
        ipAddress: null,
        userAgent: null,
        entityType: "action_proposal",
        entityId: null,
        metadata: {},
        runtimeEvent: "policy.review",
        source: "runtime",
      },
    ];

    assert.deepEqual(computeSafetySummary(entries, 2, now), {
      actionsChecked: 2,
      riskyDetected: 1,
      actionsBlocked: 0,
      approvalsWaiting: 2,
    });
  });

  it("computes protection counts from audit entries", () => {
    const now = new Date("2026-01-01T12:00:00");
    const entries: AuditTimelineEntry[] = [
      {
        id: "1",
        action: "create",
        title: "Allowed",
        description: "Allowed",
        timestamp: "2026-01-01T10:00:00.000Z",
        actor: "agent",
        actorEmail: null,
        risk: null,
        approvalStatus: "approved",
        ipAddress: null,
        userAgent: null,
        entityType: "action_proposal",
        entityId: null,
        metadata: {},
        runtimeEvent: "policy.allow",
        source: "runtime",
      },
      {
        id: "2",
        action: "reject",
        title: "Blocked",
        description: "Blocked",
        timestamp: "2026-01-01T11:00:00.000Z",
        actor: "agent",
        actorEmail: null,
        risk: null,
        approvalStatus: "rejected",
        ipAddress: null,
        userAgent: null,
        entityType: "action_proposal",
        entityId: null,
        metadata: {},
        runtimeEvent: "policy.block",
        source: "runtime",
      },
    ];

    assert.deepEqual(computeProtectionToday(entries, 3, now), {
      allowed: 1,
      needsApproval: 3,
      blocked: 1,
    });
  });

  it("builds agent cards from keys and pending approvals", () => {
    const cards = buildAgentCards(
      [
        {
          id: "key-1",
          organizationId: "org",
          agentId: "customer-support-agent",
          name: "Customer Support Agent",
          keyPrefix: "al_abcd",
          createdBy: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          revokedAt: null,
          lastUsedAt: "2026-01-01T10:00:00Z",
          expiresAt: null,
        },
      ],
      [
        samplePendingApproval(),
      ],
      []
    );

    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.status, "Needs attention");
    assert.equal(cards[0]?.pendingApprovals, 1);
  });
});
