import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeveloperFlowExample,
  DEVELOPER_DOC_LINKS,
} from "./developer-copy";

describe("developer-copy", () => {
  it("uses real gateway endpoints in examples", () => {
    const code = buildDeveloperFlowExample(
      { baseUrl: "https://app.example.com", agentId: "demo-refund-agent" },
      "typescript"
    );

    assert.match(code, /\/api\/v1\/actions\/propose/);
    assert.match(code, /\/status/);
    assert.match(code, /verify-execution/);
    assert.match(code, /ALLOW/);
    assert.match(code, /REVIEW/);
    assert.match(code, /BLOCK/);
  });

  it("only links documentation to existing routes", () => {
    for (const link of DEVELOPER_DOC_LINKS) {
      assert.ok(link.href.startsWith("/"));
      assert.ok(!link.href.includes("undefined"));
    }
  });
});
