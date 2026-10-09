import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAgentTimezone } from "./timezone";

describe("normalizeAgentTimezone", () => {
  it("maps IST to Asia/Kolkata", () => {
    assert.equal(normalizeAgentTimezone("IST"), "Asia/Kolkata");
  });

  it("passes through valid IANA zones", () => {
    assert.equal(normalizeAgentTimezone("America/New_York"), "America/New_York");
  });
});
