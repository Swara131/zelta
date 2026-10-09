import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { buildDemoFounderInsights } from "./demo-insights";
import {
  buildFounderInsights,
  INSIGHTS_PAGE_QUESTION,
} from "./founder-insights";

function buildEntry(
  id: string,
  event: string,
  agentId = "customer-support-agent",
  toolName = "issue_refund"
): AuditTimelineEntry {
  return {
    id,
    action: "update",
    title: "Event",
    description: "desc",
    timestamp: new Date(Date.now() - Number(id.replace(/\D/g, "") || "1") * 60_000).toISOString(),
    actor: agentId,
    actorEmail: null,
    risk: "medium",
    approvalStatus: null,
    ipAddress: null,
    userAgent: null,
    entityType: "action_proposal",
    entityId: id,
    metadata: {
      agentId,
      toolName,
      actionType: "financial.refund",
      amount: 1_500_000,
      currency: "INR",
    },
    runtimeEvent: event,
    proposalId: id,
    source: "runtime",
  };
}

describe("founder-insights", () => {
  it("frames insights around protection", () => {
    assert.match(INSIGHTS_PAGE_QUESTION, /protecting my AI agents/i);
  });

  it("aggregates overview counts from audit activity", () => {
    const insights = buildFounderInsights([
      buildEntry("evt-1", "policy.review"),
      buildEntry("evt-2", "policy.allow", "customer-support-agent", "send_email"),
      buildEntry("evt-3", "policy.block", "billing-agent", "delete_customer"),
    ]);

    assert.equal(insights.metrics.length, 4);
    assert.equal(insights.overview.totalActions, 3);
    assert.equal(insights.overview.needsReview, 1);
    assert.equal(insights.overview.allowed, 1);
    assert.equal(insights.overview.blocked, 1);
    assert.equal(insights.hasData, true);
    assert.ok(insights.metrics.every((metric) => metric.explanation.length > 0));
  });

  it("builds agent protection and risky action summaries", () => {
    const insights = buildFounderInsights([
      buildEntry("evt-1", "policy.review"),
      buildEntry("evt-2", "policy.review"),
      buildEntry("evt-3", "policy.block", "billing-agent", "delete_customer"),
    ]);

    assert.equal(insights.agentProtection[0]?.agentName, "Customer Support Agent");
    assert.equal(insights.agentProtection[0]?.actionsChecked, 2);
    assert.equal(insights.agentProtection[0]?.approvalRate, "100%");
    assert.ok(insights.topRiskyActions.some((row) => row.label === "Refunds"));
    assert.ok(insights.topRiskyActions.some((row) => row.label === "Data deletion"));
  });

  it("returns empty insights without inventing numbers", () => {
    const insights = buildFounderInsights([]);
    assert.equal(insights.overview.totalActions, 0);
    assert.equal(insights.hasData, false);
    assert.deepEqual(insights.agentProtection, []);
  });

  it("builds demo insights from simulated activity", () => {
    const insights = buildDemoFounderInsights();
    assert.equal(insights.isSimulated, true);
    assert.ok(insights.overview.totalActions >= 4);
    assert.ok(insights.agentProtection.length >= 2);
  });
});
