import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSetupProgressSteps,
  isAgentSetupLive,
} from "./setup-progress-steps";
import type { AgentLifecycleProgress } from "./agent-lifecycle";

const baseLifecycle: AgentLifecycleProgress = {
  mode: "protected",
  actionsConfigured: true,
  protectionConfigured: false,
  connectionAcknowledged: false,
  connectionTestPassed: false,
  testActionPassed: false,
  launched: false,
  activated: false,
  activatedAt: null,
  capabilities: [],
};

describe("setup-progress-steps", () => {
  it("marks protection and connect as actionable when incomplete", () => {
    const steps = getSetupProgressSteps("demo-agent", baseLifecycle, null);
    const protection = steps.find((s) => s.id === "protection");
    const connect = steps.find((s) => s.id === "connect");

    assert.equal(protection?.complete, false);
    assert.equal(protection?.modal, "protection");
    assert.equal(connect?.complete, false);
    assert.equal(connect?.modal, "connect");
  });

  it("detects live when all steps are complete", () => {
    const live = isAgentSetupLive(
      {
        ...baseLifecycle,
        protectionConfigured: true,
        connectionAcknowledged: true,
        testActionPassed: true,
      },
      null
    );
    assert.equal(live, true);
  });
});
