import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processEmailApprovalAction } from "./process-action";

describe("processEmailApprovalAction", () => {
  it("returns invalid for malformed tokens without executing", async () => {
    const result = await processEmailApprovalAction("not-a-valid-token", "approve");

    assert.equal(result.kind, "invalid");
    assert.match(result.title, /Invalid/i);
  });

  it("returns invalid for empty tokens", async () => {
    const result = await processEmailApprovalAction("", "deny");

    assert.equal(result.kind, "invalid");
  });
});
