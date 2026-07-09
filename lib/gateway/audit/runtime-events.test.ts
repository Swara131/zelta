import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapRuntimeAuditRowToTimelineEntry } from "@/lib/gateway/audit/mapper";
import {
  sanitizeAuditMetadata,
  RUNTIME_EVENT_TO_DB,
} from "@/lib/gateway/audit/runtime-events";

describe("sanitizeAuditMetadata", () => {
  it("redacts execution tokens and API keys", () => {
    const sanitized = sanitizeAuditMetadata({
      executionToken: "et_abc123_secretvalue",
      apiKey: "al_test_secret",
      toolName: "issue_refund",
      tokenPrefix: "et_deadbeef",
    });

    assert.equal(sanitized.executionToken, "[redacted]");
    assert.equal(sanitized.apiKey, "[redacted]");
    assert.equal(sanitized.toolName, "issue_refund");
    assert.equal(sanitized.tokenPrefix, "et_deadbeef");
  });
});

describe("RUNTIME_EVENT_TO_DB", () => {
  it("maps all required runtime event names", () => {
    const required = [
      "proposal.created",
      "policy.allow",
      "policy.review",
      "policy.block",
      "ai.risk_analyzed",
      "ai.risk_failed",
      "approval.approved",
      "approval.rejected",
      "token.issued",
      "token.verified",
      "token.consumed",
      "execution.denied",
      "proposal.expired",
    ] as const;

    for (const event of required) {
      assert.ok(RUNTIME_EVENT_TO_DB[event], `missing mapping for ${event}`);
    }
  });
});

describe("mapRuntimeAuditRowToTimelineEntry", () => {
  it("maps runtime audit rows with proposal id", () => {
    const entry = mapRuntimeAuditRowToTimelineEntry({
      id: "evt-1",
      organization_id: "11111111-1111-4111-8111-111111111111",
      action_proposal_id: "44444444-4444-4444-8444-444444444444",
      event_type: "policy_review",
      actor_id: null,
      agent_id: "refund-agent-01",
      metadata: {
        event: "policy.review",
        toolName: "issue_refund",
        actionType: "financial.refund",
      },
      ip_address: null,
      user_agent: null,
      created_at: new Date().toISOString(),
      users: null,
    });

    assert.ok(entry);
    assert.equal(entry!.runtimeEvent, "policy.review");
    assert.equal(entry!.proposalId, "44444444-4444-4444-8444-444444444444");
    assert.equal(entry!.source, "runtime");
  });
});
