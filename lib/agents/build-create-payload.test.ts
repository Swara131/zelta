import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentBuildView } from "@/lib/agent-builder/build-response";
import { buildAgentBuildViewFromParse } from "@/lib/agent-builder/build-response";
import { buildCreateAgentPayload } from "@/lib/agents/build-create-payload";
import { createBuilderAgentSchema } from "@/lib/security/validation";

function sampleBuild(): AgentBuildView {
  return buildAgentBuildViewFromParse(
    {
      name: "custom-agent",
      description: "Send professional responses to customer emails every morning.",
      tools: ["send_email"],
      triggerType: "schedule",
      suggestedThreshold: 5000,
    },
    "Send professional responses to customer emails every morning"
  );
}

describe("createBuilderAgentSchema", () => {
  it("accepts a valid builder payload", () => {
    const parsed = createBuilderAgentSchema.parse({
      name: "refund-handler",
      description: "Email customers their refund status and issue refunds under ₹5,000",
      source: "zelta-builder",
      tools: ["send_email", "issue_refund"],
      triggerType: "schedule",
      suggestedThreshold: 5000,
    });

    assert.equal(parsed.triggerType, "schedule");
    assert.equal(parsed.tools.length, 2);
  });

  it("rejects short names and descriptions", () => {
    assert.throws(() =>
      createBuilderAgentSchema.parse({
        name: "abc",
        description: "Too short",
        tools: ["send_email"],
        triggerType: "email",
      })
    );
  });
});

describe("buildCreateAgentPayload", () => {
  it("maps build view to API payload with lowercase trigger", () => {
    const build = sampleBuild();
    const payload = buildCreateAgentPayload(build);

    assert.equal(payload.name, "custom-agent");
    assert.equal(payload.source, "zelta-builder");
    assert.deepEqual(payload.tools, ["send_email"]);
    assert.equal(payload.triggerType, "schedule");
  });
});
