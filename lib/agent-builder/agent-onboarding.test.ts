import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAgentOnboarding, stepCompletion } from "./agent-onboarding";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentLifecycleProgress } from "./agent-lifecycle";

function makeKey(overrides: Partial<AgentApiKeyRecord> = {}): AgentApiKeyRecord {
  return {
    id: "key-1",
    organizationId: "org-1",
    agentId: "support-agent",
    name: "Support Agent",
    keyPrefix: "zlt_abc",
    createdBy: "user-1",
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("agent-onboarding lifecycle", () => {
  it("shows setup incomplete for a new agent", () => {
    const lifecycle: AgentLifecycleProgress = {
      mode: "standalone",
      actionsConfigured: false,
      protectionConfigured: false,
      connectionAcknowledged: false,
      connectionTestPassed: false,
      testActionPassed: false,
      launched: false,
      activated: false,
      activatedAt: null,
      capabilities: [],
    };

    const state = computeAgentOnboarding(
      {
        agentId: "support-agent",
        key: makeKey(),
        spec: null,
        approvals: [],
        auditEntries: [],
      },
      { lifecycle }
    );

    assert.equal(state.statusLabel, "Setup incomplete");
    assert.equal(state.primaryCta.label, "Continue Setup →");
    assert.deepEqual(stepCompletion(lifecycle), [true, false, false, false, false, false]);
  });

  it("shows protected after full activation", () => {
    const lifecycle: AgentLifecycleProgress = {
      mode: "protected",
      actionsConfigured: true,
      protectionConfigured: true,
      connectionAcknowledged: true,
      connectionTestPassed: true,
      testActionPassed: true,
      launched: false,
      activated: true,
      activatedAt: "2026-01-02T00:00:00.000Z",
      capabilities: ["send-email"],
    };

    const state = computeAgentOnboarding(
      {
        agentId: "support-agent",
        key: makeKey(),
        spec: null,
        approvals: [],
        auditEntries: [],
      },
      { lifecycle }
    );

    assert.equal(state.statusLabel, "Protected");
    assert.equal(state.primaryCta.label, "Open Agent Dashboard →");
  });
});
