import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFallbackAgentBuildParse } from "@/lib/xai/fallback-agent-build";

describe("buildFallbackAgentBuildParse", () => {
  it("infers refund + email tools from a refund sentence", () => {
    const parsed = buildFallbackAgentBuildParse(
      "Email customers their refund status and issue refunds under ₹5,000"
    );

    assert.equal(parsed.name, "refund-handler");
    assert.deepEqual(parsed.tools, ["send_email", "issue_refund"]);
    assert.equal(parsed.triggerType, "email");
    assert.equal(parsed.suggestedThreshold, 5000);
  });

  it("infers alert handler tools", () => {
    const parsed = buildFallbackAgentBuildParse(
      "Monitor alerts and notify relevant team members about incidents"
    );

    assert.equal(parsed.name, "alert-handler");
    assert.ok(parsed.tools.includes("send_email"));
    assert.equal(parsed.triggerType, "webhook");
  });
});
