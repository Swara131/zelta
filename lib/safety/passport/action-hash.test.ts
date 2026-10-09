import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareActionHashes,
  generateActionHash,
  verifyActionHash,
} from "./action-hash";
import { computePassportActionHash } from "./canonicalize";

const BASE = {
  organizationId: "org-1",
  builderAgentId: "agent-1",
  gatewayAgentId: "gw-1",
  agentRunId: "run-1",
  missionGoal: "Research competitors and email summaries",
  safetyDecision: "ALLOW" as const,
  tool: "send_email",
  action: "communication.send_email",
  parameters: {
    recipient: "user@example.com",
    amount: 100,
    resource: "customers/123",
  },
};

describe("action hash", () => {
  it("identical action produces the same hash", () => {
    const first = computePassportActionHash(BASE);
    const second = computePassportActionHash(BASE);

    assert.equal(first.actionHash, second.actionHash);
    assert.equal(compareActionHashes(first.actionHash, second.actionHash), true);
  });

  it("changed recipient produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      parameters: { ...BASE.parameters, recipient: "attacker@example.com" },
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("changed amount produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      parameters: { ...BASE.parameters, amount: 9999 },
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("changed tool produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      tool: "web_search",
      action: "research.web_search",
      parameters: { query: "competitors" },
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("changed resource produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      parameters: { ...BASE.parameters, resource: "customers/999" },
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("changed agent produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      builderAgentId: "agent-2",
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("changed mission produces a different hash", () => {
    const authorized = computePassportActionHash(BASE);
    const tampered = computePassportActionHash({
      ...BASE,
      missionGoal: "Send marketing blasts to everyone",
    });

    assert.notEqual(authorized.actionHash, tampered.actionHash);
  });

  it("verifyActionHash uses timing-safe comparison", () => {
    const { actionHash } = generateActionHash(BASE);
    const match = verifyActionHash(actionHash, BASE);
    const mismatch = verifyActionHash(actionHash, {
      ...BASE,
      parameters: { ...BASE.parameters, recipient: "attacker@example.com" },
    });

    assert.equal(match.match, true);
    assert.equal(mismatch.match, false);
  });

  it("ignores irrelevant timestamp and generated id fields in parameters", () => {
    const clean = computePassportActionHash({
      ...BASE,
      parameters: { recipient: "user@example.com" },
    });
    const noisy = computePassportActionHash({
      ...BASE,
      parameters: {
        recipient: "user@example.com",
        timestamp: "2026-09-22T10:00:00Z",
        requestId: "req-abc-123",
        passportId: "passport-xyz",
        createdAt: "2026-09-22T10:00:00Z",
      },
    });

    assert.equal(clean.actionHash, noisy.actionHash);
  });

  it("redacts secrets from hashed parameters", () => {
    const result = computePassportActionHash({
      ...BASE,
      parameters: {
        recipient: "user@example.com",
        api_key: "super-secret-key-value",
        password: "hunter2",
      },
    });

    assert.equal(result.sanitizedParameters.api_key, "[redacted]");
    assert.equal(result.sanitizedParameters.password, "[redacted]");
  });
});
