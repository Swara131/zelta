import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentBuildViewFromParse } from "@/lib/agent-builder/build-response";
import {
  formatTriggerDisplay,
  normalizeTriggerType,
  validateAgentBuildView,
} from "@/lib/agent-builder/validate-agent-build";
import { parseAgentBuildPayload } from "@/lib/xai/parse-agent-build";

describe("normalizeTriggerType", () => {
  it("normalizes capitalized Grok values to lowercase", () => {
    assert.equal(normalizeTriggerType("Schedule"), "schedule");
    assert.equal(normalizeTriggerType("EMAIL"), "email");
    assert.equal(normalizeTriggerType(" Webhook "), "webhook");
  });

  it("rejects invalid trigger values", () => {
    assert.equal(normalizeTriggerType("Validation failed"), null);
    assert.equal(normalizeTriggerType("cron"), null);
  });
});

describe("parseAgentBuildPayload trigger normalization", () => {
  it("accepts case-insensitive triggerType from Grok", () => {
    const parsed = parseAgentBuildPayload({
      name: "custom-agent",
      description: "Sends emails on a schedule.",
      tools: ["send_email"],
      triggerType: "Schedule",
      suggestedThreshold: 5000,
    });

    assert.equal(parsed.triggerType, "schedule");
  });
});

describe("validateAgentBuildView", () => {
  it("passes a valid build view with normalized trigger display", () => {
    const view = buildAgentBuildViewFromParse(
      {
        name: "custom-agent",
        description: "Sends emails on a schedule.",
        tools: ["send_email"],
        triggerType: "schedule",
        suggestedThreshold: 5000,
      },
      "Send professional responses to customer emails every morning"
    );

    const withCapitalTrigger = { ...view, triggerType: "Schedule" };
    const result = validateAgentBuildView(withCapitalTrigger);

    assert.equal(result.valid, true);
    assert.equal(result.normalizedTrigger, "schedule");
    assert.equal(formatTriggerDisplay(result.normalizedTrigger!), "Schedule");
  });

  it("surfaces invalid trigger errors", () => {
    const view = buildAgentBuildViewFromParse(
      {
        name: "custom-agent",
        description: "Sends emails.",
        tools: ["send_email"],
        triggerType: "email",
        suggestedThreshold: 5000,
      },
      "Send professional responses to customer emails every morning"
    );

    const result = validateAgentBuildView({ ...view, triggerType: "Validation failed" });

    assert.equal(result.valid, false);
    assert.match(result.fieldErrors.triggerType!, /email, webhook, or schedule/);
  });
});
