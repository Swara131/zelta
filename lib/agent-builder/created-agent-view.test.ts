import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFallbackAgentSpec } from "./fallback-spec";
import { buildCreatedAgentViewModel } from "./created-agent-view";
import { buildAgentTestActions } from "./test-actions";

describe("buildCreatedAgentViewModel", () => {
  it("derives protection counts from agent spec", () => {
    const spec = buildFallbackAgentSpec(
      "Email customers and issue refunds under ₹5,000 automatically."
    );
    const view = buildCreatedAgentViewModel(spec);

    assert.equal(view.status, "Protected");
    assert.equal(view.statusDetail, "Active");
    assert.ok(view.allowedCount >= 1);
    assert.ok(view.reviewCount >= 1);
    assert.ok(view.blockedCount >= 1);
  });
});

describe("buildAgentTestActions", () => {
  it("builds three policy-backed test actions for an agent", () => {
    const actions = buildAgentTestActions("my-agent-id");
    assert.equal(actions.length, 3);
    assert.ok(actions.every((action) => action.propose.agentId === "my-agent-id"));
  });
});
