import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmailApprovalActionUrl,
  buildEmailApprovalReviewUrl,
} from "./urls";

describe("buildEmailApprovalActionUrl", () => {
  it("builds public approve and deny paths with encoded token", () => {
    const base = "https://zelta.example";
    const token = "al_rev_abcd1234_secretpart";
    assert.equal(
      buildEmailApprovalActionUrl(base, "approve", token),
      "https://zelta.example/approve/al_rev_abcd1234_secretpart"
    );
    assert.equal(
      buildEmailApprovalActionUrl(base, "deny", token),
      "https://zelta.example/deny/al_rev_abcd1234_secretpart"
    );
  });
});

describe("buildEmailApprovalReviewUrl", () => {
  it("builds dashboard deep link", () => {
    assert.equal(
      buildEmailApprovalReviewUrl(
        "https://zelta.example/",
        "44444444-4444-4444-8444-444444444444"
      ),
      "https://zelta.example/approvals?proposal=44444444-4444-4444-8444-444444444444"
    );
  });
});
