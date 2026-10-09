import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentBuildViewFromParse } from "@/lib/agent-builder/build-response";
import { GrokAgentBuilderError } from "@/lib/xai/errors";
import { parseAgentBuildPayload } from "@/lib/xai/parse-agent-build";

describe("parseAgentBuildPayload", () => {
  it("accepts a valid Grok agent build payload", () => {
    const parsed = parseAgentBuildPayload({
      name: "refund-handler",
      description: "Emails customers and issues refunds under ₹5,000.",
      tools: ["send_email", "issue_refund"],
      triggerType: "email",
      suggestedThreshold: 5000,
    });

    assert.equal(parsed.name, "refund-handler");
    assert.deepEqual(parsed.tools, ["send_email", "issue_refund"]);
    assert.equal(parsed.triggerType, "email");
    assert.equal(parsed.suggestedThreshold, 5000);
  });

  it("accepts case-insensitive triggerType from Grok", () => {
    const parsed = parseAgentBuildPayload({
      name: "refund-handler",
      description: "Emails customers and issues refunds under ₹5,000.",
      tools: ["send_email", "issue_refund"],
      triggerType: "Schedule",
      suggestedThreshold: 5000,
    });

    assert.equal(parsed.triggerType, "schedule");
  });

  it("rejects invalid JSON shapes", () => {
    assert.throws(
      () =>
        parseAgentBuildPayload({
          name: "refund-handler",
          description: "Missing tools",
          triggerType: "email",
          suggestedThreshold: 5000,
        }),
      GrokAgentBuilderError
    );
  });

  it("rejects unknown tools", () => {
    assert.throws(
      () =>
        parseAgentBuildPayload({
          name: "refund-handler",
          description: "Bad tools",
          tools: ["delete_everything"],
          triggerType: "email",
          suggestedThreshold: 5000,
        }),
      GrokAgentBuilderError
    );
  });
});

describe("buildAgentBuildViewFromParse", () => {
  it("maps Grok output into a frontend-ready build view", () => {
    const view = buildAgentBuildViewFromParse(
      {
        name: "refund-handler",
        description: "Emails customers and issues refunds under ₹5,000.",
        tools: ["send_email", "issue_refund"],
        triggerType: "email",
        suggestedThreshold: 5000,
      },
      "Email customers their refund status and issue refunds under ₹5,000"
    );

    assert.equal(view.success, true);
    assert.equal(view.spec.agentId, "refund-handler");
    assert.equal(view.spec.name, "Refund Handler");
    assert.equal(view.spec.source, "grok");
    assert.equal(view.suggestedThreshold, 5000);
    assert.equal(view.suggestedThresholdInr, 5000);
    assert.ok(view.tools.includes("Send email"));
  });
});
