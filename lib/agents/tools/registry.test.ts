import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveToolName, getToolDefinition } from "./catalog";
import {
  assertToolEnabledForAgent,
  isToolRegistered,
  normalizeEnabledTools,
} from "./registry";

describe("tool registry", () => {
  it("resolves legacy database tool aliases", () => {
    assert.equal(resolveToolName("query_database"), "query_supabase");
    assert.ok(getToolDefinition("query_database"));
  });

  it("blocks tools not enabled on the agent", () => {
    assert.throws(
      () => assertToolEnabledForAgent(["send_email"], "web_search"),
      /not enabled/
    );
  });

  it("registers core Phase 5 tools", () => {
    for (const name of [
      "web_search",
      "http_request",
      "send_email",
      "google_sheets",
      "x_search",
      "query_supabase",
      "read_document",
    ]) {
      assert.ok(isToolRegistered(name), `missing ${name}`);
    }
  });

  it("normalizes enabled tool names", () => {
    assert.deepEqual(normalizeEnabledTools(["query_database", "send_email"]), [
      "query_supabase",
      "send_email",
    ]);
  });
});
