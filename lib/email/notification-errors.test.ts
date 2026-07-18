import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNotificationUniqueViolation } from "./notification-errors";

describe("isNotificationUniqueViolation", () => {
  it("detects postgres unique violations by code", () => {
    assert.equal(isNotificationUniqueViolation({ code: "23505" }), true);
  });

  it("detects duplicate key messages", () => {
    assert.equal(
      isNotificationUniqueViolation(
        new Error('duplicate key value violates unique constraint "idx"')
      ),
      true
    );
  });

  it("returns false for unrelated errors", () => {
    assert.equal(isNotificationUniqueViolation(new Error("timeout")), false);
  });
});
