import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeReviewExpiresAt,
  parseReviewDeadlineHours,
  parseReviewEscalationMaxLevel,
  parseReviewTimeoutBehavior,
} from "./config";

describe("review config", () => {
  it("defaults timeout behavior to auto_deny", () => {
    assert.equal(parseReviewTimeoutBehavior(undefined), "auto_deny");
    assert.equal(parseReviewTimeoutBehavior("invalid"), "auto_deny");
    assert.equal(parseReviewTimeoutBehavior("escalate"), "escalate");
  });

  it("defaults review deadline to 4 hours", () => {
    assert.equal(parseReviewDeadlineHours(undefined), 4);
    assert.equal(parseReviewDeadlineHours("8"), 8);
  });

  it("defaults escalation max level to 3", () => {
    assert.equal(parseReviewEscalationMaxLevel(undefined), 3);
    assert.equal(parseReviewEscalationMaxLevel("5"), 5);
  });

  it("caps review deadline at proposal expires_at", () => {
    const requestedAt = new Date("2026-07-01T10:00:00.000Z");
    const proposalExpiresAt = "2026-07-01T12:00:00.000Z";
    const reviewExpiresAt = computeReviewExpiresAt({
      reviewRequestedAt: requestedAt,
      proposalExpiresAt,
      deadlineHours: 8,
    });
    assert.equal(reviewExpiresAt, proposalExpiresAt);
  });
});
