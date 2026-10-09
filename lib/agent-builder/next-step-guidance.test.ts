import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNextStepGuidance } from "./next-step-guidance";
import type { AgentLifecycleProgress } from "./agent-lifecycle";

const base: AgentLifecycleProgress = {
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

describe("next-step-guidance", () => {
  it("prioritises protection when not configured", () => {
    const guidance = getNextStepGuidance("demo-agent", base, null);
    assert.equal(guidance.id, "protection");
    assert.match(guidance.message, /Protection not yet configured/);
    assert.equal(guidance.buttonLabel, "Set up protection →");
    assert.equal(guidance.modal, "protection");
  });

  it("shows connect step after protection is done", () => {
    const guidance = getNextStepGuidance(
      "demo-agent",
      { ...base, protectionConfigured: true },
      null
    );
    assert.equal(guidance.id, "connect");
    assert.match(guidance.message, /not connected yet/);
    assert.equal(guidance.modal, "connect");
  });

  it("shows test step when protection and connect are done", () => {
    const guidance = getNextStepGuidance(
      "demo-agent",
      {
        ...base,
        protectionConfigured: true,
        connectionAcknowledged: true,
      },
      null
    );
    assert.equal(guidance.id, "test");
    assert.match(guidance.message, /Setup complete/);
    assert.equal(guidance.modal, "test");
  });

  it("shows live message with no button when complete", () => {
    const guidance = getNextStepGuidance(
      "demo-agent",
      {
        ...base,
        protectionConfigured: true,
        connectionAcknowledged: true,
        testActionPassed: true,
      },
      null
    );
    assert.equal(guidance.id, "live");
    assert.match(guidance.message, /Agent is live/);
    assert.equal(guidance.buttonLabel, undefined);
  });
});
