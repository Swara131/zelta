import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeActionParameters } from "./sanitize";

describe("sanitizeActionParameters", () => {
  it("redacts secret keys and token-like values", () => {
    const sanitized = sanitizeActionParameters({
      query: "hello",
      password: "secret",
      authorization: "Bearer abc",
    });

    assert.equal(sanitized.query, "hello");
    assert.equal(sanitized.password, "[redacted]");
    assert.equal(sanitized.authorization, "[redacted]");
  });
});
