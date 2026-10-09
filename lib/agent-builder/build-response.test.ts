import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentBuildView, extractSuggestedThresholdInr } from "./build-response";
import { buildFallbackAgentSpec } from "./fallback-spec";

describe("build-response", () => {
  it("extracts refund threshold from fallback spec", () => {
    const spec = buildFallbackAgentSpec(
      "Email customers and issue refunds under ₹5,000"
    );
    assert.equal(extractSuggestedThresholdInr(spec), 5000);
  });

  it("builds a view with trigger, tools, and threshold", () => {
    const sentence = "Email customers their refund status and issue refunds under ₹5,000";
    const spec = buildFallbackAgentSpec(sentence);
    const view = buildAgentBuildView(spec, sentence);

    assert.equal(view.trigger, sentence);
    assert.ok(view.tools.length >= 1);
    assert.equal(view.suggestedThresholdInr, 5000);
    assert.equal(view.spec.agentId, spec.agentId);
  });
});
