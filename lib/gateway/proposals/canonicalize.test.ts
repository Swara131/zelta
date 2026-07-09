import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeActionHash, normalizePayload } from "./canonicalize";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

describe("action hash canonicalization", () => {
  it("produces a stable hash for the same canonical action", () => {
    const input = {
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        customerId: "cus_123",
        amount: 500000,
        currency: "INR",
      },
    };

    const first = computeActionHash(input);
    const second = computeActionHash(input);

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("changes hash when payload changes", () => {
    const base = {
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
    };

    const hashA = computeActionHash({
      ...base,
      payload: { amount: 500000, currency: "INR", customerId: "cus_123" },
    });

    const hashB = computeActionHash({
      ...base,
      payload: { amount: 500001, currency: "INR", customerId: "cus_123" },
    });

    assert.notEqual(hashA, hashB);
  });

  it("normalizes payload key order so equivalent objects hash identically", () => {
    const hashA = computeActionHash({
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { b: 2, a: 1 },
    });

    const hashB = computeActionHash({
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { a: 1, b: 2 },
    });

    assert.equal(hashA, hashB);
    assert.deepEqual(normalizePayload({ b: 2, a: 1 }), { a: 1, b: 2 });
  });

  it("isolates organization in the hash", () => {
    const payload = {
      customerId: "cus_123",
      amount: 500000,
      currency: "INR",
    };

    const hashOrgA = computeActionHash({
      organizationId: ORG_A,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload,
    });

    const hashOrgB = computeActionHash({
      organizationId: ORG_B,
      agentId: "refund-agent-01",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload,
    });

    assert.notEqual(hashOrgA, hashOrgB);
  });
});
