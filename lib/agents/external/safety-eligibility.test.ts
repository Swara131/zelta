import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateExternalSafetyEligibility } from "./safety-eligibility";

describe("evaluateExternalSafetyEligibility", () => {
  it("allows safety for SDK gateway connections", () => {
    const result = evaluateExternalSafetyEligibility("sdk");
    assert.equal(result.eligible, true);
  });

  it("blocks safety for REST-only outbound connections", () => {
    const result = evaluateExternalSafetyEligibility("rest_api");
    assert.equal(result.eligible, false);
    assert.match(result.message, /Safety controls unavailable/);
  });
});
