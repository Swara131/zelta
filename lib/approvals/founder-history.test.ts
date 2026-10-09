import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { buildApprovalHistoryFromAudit } from "./founder-history";

describe("approval founder-history", () => {
  it("maps approved runtime audit events to history rows", () => {
    const entries: AuditTimelineEntry[] = [
      {
        id: "hist-1",
        action: "approve",
        title: "Approval Granted",
        description: "Human approved gateway proposal issue_refund",
        timestamp: "2026-08-28T10:00:00.000Z",
        actor: "user-1",
        actorEmail: "founder@example.com",
        risk: "high",
        approvalStatus: "approved",
        ipAddress: null,
        userAgent: null,
        entityType: "action_proposal",
        entityId: "proposal-1",
        metadata: {
          agentId: "customer-support-agent",
          toolName: "issue_refund",
          actionType: "financial.refund",
          amount: 5_000_000,
          currency: "INR",
        },
        runtimeEvent: "approval.approved",
        proposalId: "proposal-1",
        source: "runtime",
      },
    ];

    const history = buildApprovalHistoryFromAudit(entries);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.decision, "Approved");
    assert.equal(history[0]?.agent, "Customer Support Agent");
    assert.match(history[0]?.action ?? "", /₹50,000/);
    assert.equal(history[0]?.reviewer, "founder@example.com");
  });

  it("returns empty history when no decision events exist", () => {
    assert.deepEqual(buildApprovalHistoryFromAudit([]), []);
  });
});
