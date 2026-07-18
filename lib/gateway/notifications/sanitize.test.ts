import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApprovalsReviewUrl,
  sanitizeNotificationText,
} from "./sanitize";

describe("sanitizeNotificationText", () => {
  it("redacts execution token patterns", () => {
    assert.equal(
      sanitizeNotificationText("et_abc123def456ghi789jkl012"),
      "[redacted]"
    );
  });

  it("truncates long summaries", () => {
    const long = "a".repeat(600);
    const result = sanitizeNotificationText(long, 100);
    assert.ok(result.length <= 100);
    assert.ok(result.endsWith("…"));
  });

  it("preserves safe plain text", () => {
    const text = "Refund of 500 INR for customer cus_123";
    assert.equal(sanitizeNotificationText(text), text);
  });
});

describe("buildApprovalsReviewUrl", () => {
  it("builds secure approvals link with proposal id", () => {
    const url = buildApprovalsReviewUrl(
      "44444444-4444-4444-8444-444444444444",
      "https://app.example.com/"
    );
    assert.equal(
      url,
      "https://app.example.com/approvals?proposal=44444444-4444-4444-8444-444444444444"
    );
  });
});
