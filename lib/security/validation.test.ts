import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { translatorPostSchema } from "./validation";

describe("translatorPostSchema", () => {
  it("accepts logContent when uploadedLogId is null", () => {
    const result = translatorPostSchema.safeParse({
      logContent: "2026-06-28 agent action",
      filename: "sample-agent-logs.csv",
      uploadedLogId: null,
    });

    assert.equal(result.success, true);
  });

  it("accepts uploadedLogId without logContent", () => {
    const result = translatorPostSchema.safeParse({
      uploadedLogId: "00000000-0000-4000-8000-000000000001",
    });

    assert.equal(result.success, true);
  });

  it("rejects empty payloads", () => {
    const result = translatorPostSchema.safeParse({
      uploadedLogId: null,
      logContent: "",
    });

    assert.equal(result.success, false);
  });
});
