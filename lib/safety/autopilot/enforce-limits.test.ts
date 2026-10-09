import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkExecutionLimits } from "./enforce-limits";
import type { AgentExecutionLimitRecord } from "./types";

const limits: AgentExecutionLimitRecord = {
  id: "l1",
  agentId: "a1",
  organizationId: "o1",
  maxCostPerRunUsd: 2,
  dailySpendingCapUsd: 25,
  maxToolCallsPerRun: 10,
  maxExecutionTimeSeconds: 120,
  maxRetries: 2,
  maxMessagesPerRun: 5,
};

describe("checkExecutionLimits", () => {
  it("allows runs within limits", () => {
    const result = checkExecutionLimits(limits, {
      estimatedCostUsd: 1.5,
      toolCallCount: 5,
      messageCount: 3,
    });
    assert.equal(result.allowed, true);
  });

  it("blocks when cost exceeds cap", () => {
    const result = checkExecutionLimits(limits, { estimatedCostUsd: 5 });
    assert.equal(result.allowed, false);
    assert.equal(result.violatedField, "maxCostPerRunUsd");
  });

  it("blocks excessive tool calls", () => {
    const result = checkExecutionLimits(limits, { toolCallCount: 15 });
    assert.equal(result.allowed, false);
    assert.equal(result.violatedField, "maxToolCallsPerRun");
  });
});
