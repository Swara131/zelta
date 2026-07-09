import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProposeExamples,
  buildStatusExamples,
  buildVerifyExamples,
} from "@/lib/gateway/integration-examples";

describe("integration examples", () => {
  it("builds curl/typescript/python propose examples without secrets", () => {
    const examples = buildProposeExamples({
      baseUrl: "http://localhost:3000",
      agentId: "demo-refund-agent",
    });

    assert.ok(examples.curl.includes("Authorization: Bearer YOUR_AGENT_API_KEY"));
    assert.ok(examples.typescript.includes("process.env.AGENT_API_KEY"));
    assert.ok(examples.python.includes('os.environ["AGENT_API_KEY"]'));
    assert.ok(!examples.curl.includes("service_role"));
  });

  it("builds status and verify examples with proposal id", () => {
    const proposalId = "44444444-4444-4444-8444-444444444444";
    const status = buildStatusExamples({
      baseUrl: "http://localhost:3000/",
      agentId: "demo-refund-agent",
      proposalId,
    });
    const verify = buildVerifyExamples({
      baseUrl: "http://localhost:3000",
      agentId: "demo-refund-agent",
      proposalId,
    });

    assert.ok(status.curl.includes(proposalId));
    assert.ok(verify.curl.includes("verify-execution"));
    assert.ok(verify.curl.includes("YOUR_EXECUTION_TOKEN"));
  });
});
