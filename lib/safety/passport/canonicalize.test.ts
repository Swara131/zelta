import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalizePassportAction, computePassportActionHash } from "./canonicalize";

describe("passport canonicalization", () => {
  it("produces stable canonical JSON with sorted parameter keys", () => {
    const canonical = canonicalizePassportAction({
      organizationId: "org-1",
      builderAgentId: "agent-1",
      gatewayAgentId: "gw-1",
      agentRunId: "run-1",
      missionGoal: "Daily research",
      safetyDecision: "ALLOW",
      tool: "send_email",
      action: "communication.send_email",
      parameters: { subject: "Hi", recipient: "user@example.com" },
    });

    assert.deepEqual(Object.keys(canonical.parameters).sort(), ["recipient", "subject"]);
    assert.equal(canonical.missionGoal, "Daily research");
    assert.equal(canonical.authorizationContext.safetyDecision, "ALLOW");
  });

  it("produces stable hashes for identical actions", () => {
    const input = {
      organizationId: "org-1",
      builderAgentId: "agent-1",
      gatewayAgentId: "gw-1",
      agentRunId: "run-1",
      missionGoal: "Notify users",
      safetyDecision: "ALLOW" as const,
      tool: "send_email",
      action: "communication.send_email",
      parameters: { recipient: "user@example.com", api_key: "secret-value-should-redact" },
    };

    const first = computePassportActionHash(input);
    const second = computePassportActionHash(input);

    assert.equal(first.actionHash, second.actionHash);
    assert.equal(first.sanitizedParameters.api_key, "[redacted]");
  });

  it("ignores runtime-only metadata keys", () => {
    const base = {
      organizationId: "org-1",
      builderAgentId: "agent-1",
      gatewayAgentId: "gw-1",
      agentRunId: "run-1",
      missionGoal: null,
      tool: "web_search",
      action: "research.web_search",
    };

    const withoutRuntime = computePassportActionHash({
      ...base,
      parameters: { query: "zelta" },
    });
    const withRuntime = computePassportActionHash({
      ...base,
      parameters: {
        query: "zelta",
        _zeltaRuntimeRunId: "run-1",
        _zeltaRuntimeSource: "agent_runtime",
      },
    });

    assert.equal(withoutRuntime.actionHash, withRuntime.actionHash);
  });
});
