import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTemplateAgentDescription } from "./build-template-description";
import { LEGACY_TEMPLATE_SEED_DATA } from "./seed-data";

describe("buildTemplateAgentDescription", () => {
  it("replaces threshold and appends custom instructions", () => {
    const template = LEGACY_TEMPLATE_SEED_DATA[0];
    const description = buildTemplateAgentDescription(template, {
      threshold: 3000,
      needsApproval: false,
      customInstructions: "Only refund if customer has order history",
    });

    assert.match(description, /₹3,000/);
    assert.match(description, /Only refund if customer has order history/);
  });

  it("adds approval requirement when enabled", () => {
    const template = LEGACY_TEMPLATE_SEED_DATA[1];
    const description = buildTemplateAgentDescription(template, {
      needsApproval: true,
    });

    assert.match(description, /Require human approval/i);
  });
});
