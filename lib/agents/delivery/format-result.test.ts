import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitAgentResultForDelivery } from "./format-result";

describe("splitAgentResultForDelivery", () => {
  it("splits summary body from sources section", () => {
    const summary = `OpenAI released a new model today.

Sources:
- https://example.com/a
- https://example.com/b`;

    const split = splitAgentResultForDelivery(summary);
    assert.match(split.summaryBody, /OpenAI released/);
    assert.equal(split.sources.length, 2);
    assert.match(split.sources[0]!, /example\.com\/a/);
  });

  it("returns full text when no sources section", () => {
    const summary = "Plain summary without sources.";
    const split = splitAgentResultForDelivery(summary);
    assert.equal(split.summaryBody, summary);
    assert.equal(split.sources.length, 0);
  });
});
