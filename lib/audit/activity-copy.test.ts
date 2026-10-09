import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditTimelineEntry } from "./types";
import {
  applyActivityFilters,
  buildFounderActivityView,
  filterFounderActivities,
  formatRelativeTime,
} from "./activity-copy";

function buildEntry(overrides: Partial<AuditTimelineEntry> = {}): AuditTimelineEntry {
  return {
    id: "evt-1",
    action: "update",
    title: "Review Required",
    description: "issue_refund · financial.refund",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    actor: "customer-support-agent",
    actorEmail: null,
    risk: "medium",
    approvalStatus: "pending",
    ipAddress: null,
    userAgent: null,
    entityType: "action_proposal",
    entityId: "proposal-1",
    metadata: {
      agentId: "customer-support-agent",
      toolName: "issue_refund",
      actionType: "financial.refund",
      amount: 1_500_000,
      currency: "INR",
    },
    runtimeEvent: "policy.review",
    proposalId: "00000000-0000-4000-8000-000000000099",
    source: "runtime",
    ...overrides,
  };
}

describe("activity-copy", () => {
  it("formats refund approval requests for founders", () => {
    const view = buildFounderActivityView(buildEntry());
    assert.ok(view);
    assert.equal(view.agentName, "Customer Support Agent");
    assert.equal(view.actionLabel, "Refund ₹15,000");
    assert.equal(view.decisionLabel, "Approval Required");
    assert.equal(view.statusLabel, "Waiting");
    assert.equal(view.riskLabel, "High");
    assert.match(view.reason, /approval limit/i);
    assert.equal(view.filterCategory, "review");
    assert.match(view.whyDecision, /₹5,000/);
    assert.equal(view.details.finalDecision, "Approval Required");
    assert.equal(view.finalDecisionText, "Waiting for approval");
    assert.match(view.details.executionResult, /Paused/i);
    assert.match(view.proposedAction, /₹15,000/);
    assert.equal(view.zeltaChecked.policy, "Approval required");
    assert.equal(view.zeltaChecked.humanReview, "Required");
  });

  it("filters activities by founder categories", () => {
    const allowed = buildFounderActivityView(
      buildEntry({
        id: "evt-2",
        runtimeEvent: "policy.allow",
        metadata: {
          agentId: "customer-support-agent",
          toolName: "send_email",
          actionType: "communication.email",
        },
      })
    );
    const blocked = buildFounderActivityView(
      buildEntry({
        id: "evt-3",
        runtimeEvent: "policy.block",
        metadata: {
          agentId: "customer-support-agent",
          toolName: "delete_customer",
          actionType: "customer.delete",
        },
      })
    );

    const activities = [allowed, blocked].filter(Boolean) as NonNullable<
      ReturnType<typeof buildFounderActivityView>
    >[];

    assert.equal(filterFounderActivities(activities, "blocked").length, 1);
    assert.equal(filterFounderActivities(activities, "allowed").length, 1);
  });

  it("applies agent and decision filters together", () => {
    const review = buildFounderActivityView(buildEntry());
    const allowed = buildFounderActivityView(
      buildEntry({
        id: "evt-4",
        runtimeEvent: "policy.allow",
        metadata: {
          agentId: "billing-agent",
          toolName: "send_email",
          actionType: "communication.email",
        },
      })
    );

    const activities = [review, allowed].filter(Boolean) as NonNullable<
      ReturnType<typeof buildFounderActivityView>
    >[];

    const filtered = applyActivityFilters(activities, {
      agent: "customer-support-agent",
      decision: "review",
      actionType: "all",
      date: "all",
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.decisionLabel, "Approval Required");
  });

  it("formats relative time", () => {
    const iso = new Date(Date.now() - 2 * 60_000).toISOString();
    assert.equal(formatRelativeTime(iso), "2 minutes ago");
  });
});
