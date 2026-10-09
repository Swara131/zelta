import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  ACTION_HASH_MISMATCH_MESSAGE,
  PASSPORT_MISMATCH_MESSAGE,
} from "./constants";
import { computePassportActionHash } from "./canonicalize";
import { createMemoryActionPassportStore } from "./memory-store";
import {
  consumeActionPassport,
  createActionPassport,
  revokeActionPassport,
  setActionPassportStoreForTests,
  verifyActionPassport,
} from "./service";

const BASE = {
  organizationId: "org-1",
  builderAgentId: "agent-1",
  gatewayAgentId: "gw-agent-1",
  agentRunId: "run-1",
  missionGoal: "Send customer updates",
  safetyDecision: "ALLOW" as const,
  tool: "send_email",
  action: "communication.send_email",
  parameters: { recipient: "user@example.com", subject: "Hello" },
};

afterEach(() => {
  setActionPassportStoreForTests(null);
});

describe("Action Passport service", () => {
  it("allows execution when passport is valid", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({
      ...BASE,
    });

    const verified = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
    });
    assert.equal(verified.valid, true);

    const consumed = await consumeActionPassport({
      passportId: created.passportId,
      ...BASE,
    });
    assert.equal(consumed.valid, true);
    assert.equal(consumed.passport?.status, "used");
  });

  it("blocks expired passports", async () => {
    const store = createMemoryActionPassportStore();
    setActionPassportStoreForTests(store);

    const { actionHash, sanitizedParameters } = computePassportActionHash(BASE);
    const passportId = "passport-expired";
    await store.insert({
      id: passportId,
      organizationId: BASE.organizationId,
      builderAgentId: BASE.builderAgentId,
      gatewayAgentId: BASE.gatewayAgentId,
      agentRunId: BASE.agentRunId,
      agentActionId: null,
      actionProposalId: null,
      toolName: BASE.tool,
      actionType: BASE.action,
      actionHash,
      parametersSnapshot: sanitizedParameters,
      missionGoal: BASE.missionGoal,
      safetyDecision: "ALLOW",
      status: "active",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      usedAt: null,
      revokedAt: null,
    });

    const result = await verifyActionPassport({
      passportId,
      ...BASE,
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, PASSPORT_MISMATCH_MESSAGE);
  });

  it("blocks reused passports", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const firstUse = await consumeActionPassport({
      passportId: created.passportId,
      ...BASE,
    });
    assert.equal(firstUse.valid, true);

    const secondUse = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
    });
    assert.equal(secondUse.valid, false);
    assert.equal(secondUse.reason, PASSPORT_MISMATCH_MESSAGE);
  });

  it("blocks when parameters are modified", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
      parameters: { recipient: "attacker@example.com", subject: "Hello" },
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, ACTION_HASH_MISMATCH_MESSAGE);
  });

  it("blocks when tool differs", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
      tool: "web_search",
      action: "research.web_search",
      parameters: { query: "test" },
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, ACTION_HASH_MISMATCH_MESSAGE);
  });

  it("blocks when agent differs", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
      builderAgentId: "agent-2",
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, ACTION_HASH_MISMATCH_MESSAGE);
  });

  it("blocks when run differs", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
      agentRunId: "run-2",
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, ACTION_HASH_MISMATCH_MESSAGE);
  });

  it("blocks when mission differs", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
      missionGoal: "A completely different mission",
    });

    assert.equal(result.valid, false);
    assert.equal(result.reason, ACTION_HASH_MISMATCH_MESSAGE);
  });

  it("revokes active passports", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    const created = await createActionPassport({ ...BASE });

    const revoked = await revokeActionPassport(created.passportId);
    assert.equal(revoked, true);

    const result = await verifyActionPassport({
      passportId: created.passportId,
      ...BASE,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, PASSPORT_MISMATCH_MESSAGE);
  });

  it("rejects passport creation for non-ALLOW decisions", async () => {
    setActionPassportStoreForTests(createMemoryActionPassportStore());

    await assert.rejects(
      () =>
        createActionPassport({
          ...BASE,
          safetyDecision: "REQUIRE_APPROVAL",
        }),
      /only issued for ALLOW/
    );
  });
});
