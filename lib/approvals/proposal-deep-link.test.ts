import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PendingApproval } from "@/lib/approval-types";
import {
  findAuthorizedProposalForDeepLink,
  parseProposalDeepLinkParam,
  shouldClearFilterForDeepLink,
} from "./proposal-deep-link";

const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ORG_PROPOSAL = "55555555-5555-5555-8555-555555555555";

function buildApproval(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    id: PROPOSAL_ID,
    title: "issue_refund — financial.refund",
    agentId: "refund-agent-01",
    riskSeverity: "medium",
    priority: "p3",
    aiExplanation: "Test",
    businessJustification: "Test",
    affectedSystems: [],
    affectedUsers: [],
    complianceImpact: "Test",
    recommendedAction: "Review",
    confidenceScore: 50,
    timeline: [],
    history: [],
    submittedAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 60_000).toISOString(),
    assignee: "Unassigned",
    requester: "refund-agent-01",
    source: "gateway",
    toolName: "issue_refund",
    actionType: "financial.refund",
    actionPayload: {},
    actionHash: "hash-abc",
    matchedPolicies: [],
    aiRiskReasons: [],
    riskScore: 50,
    ...overrides,
  };
}

describe("proposal deep-link helpers", () => {
  it("accepts valid UUID proposal params", () => {
    assert.equal(parseProposalDeepLinkParam(PROPOSAL_ID), PROPOSAL_ID);
  });

  it("rejects invalid proposal params silently", () => {
    assert.equal(parseProposalDeepLinkParam("not-a-uuid"), null);
    assert.equal(parseProposalDeepLinkParam("<script>"), null);
    assert.equal(parseProposalDeepLinkParam(null), null);
  });

  it("finds authorized proposal only within loaded org list", () => {
    const approvals = [buildApproval()];
    assert.equal(
      findAuthorizedProposalForDeepLink(approvals, PROPOSAL_ID)?.id,
      PROPOSAL_ID
    );
    assert.equal(
      findAuthorizedProposalForDeepLink(approvals, OTHER_ORG_PROPOSAL),
      null
    );
  });

  it("clears severity filter when deep-linked proposal is hidden", () => {
    const approval = buildApproval({ riskSeverity: "medium" });
    assert.equal(shouldClearFilterForDeepLink("high", approval), true);
    assert.equal(shouldClearFilterForDeepLink("all", approval), false);
    assert.equal(shouldClearFilterForDeepLink("medium", approval), false);
  });
});
