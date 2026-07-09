import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentAuthError } from "@/lib/gateway/errors";
import { handleProposeActionRequest } from "@/app/api/v1/actions/propose/route";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import { proposeActionSchema } from "@/lib/security/validation";
import type { ActionProposalRow } from "./repository";
import { proposeAction } from "./service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

const AUTH_CONTEXT: AgentAuthContext = {
  keyId: "key-1",
  organizationId: ORG_A,
  agentId: "refund-agent-01",
  keyPrefix: "al_test1234",
};

function buildProposalRow(
  overrides: Partial<ActionProposalRow> = {}
): ActionProposalRow {
  return {
    id: overrides.id ?? "44444444-4444-4444-8444-444444444444",
    organization_id: overrides.organization_id ?? ORG_A,
    agent_id: overrides.agent_id ?? "refund-agent-01",
    tool_name: overrides.tool_name ?? "issue_refund",
    action_type: overrides.action_type ?? "financial.refund",
    action_payload: overrides.action_payload ?? {
      customerId: "cus_123",
      amount: 500_000,
      currency: "INR",
    },
    action_hash: overrides.action_hash ?? "abc123",
    plain_english_summary: overrides.plain_english_summary ?? null,
    risk_level: overrides.risk_level ?? "medium",
    risk_score: overrides.risk_score ?? 0,
    risk_reasons: overrides.risk_reasons ?? [],
    policy_decision: overrides.policy_decision ?? null,
    status: overrides.status ?? "pending",
    requested_by: overrides.requested_by ?? null,
    idempotency_key: overrides.idempotency_key ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
    expires_at:
      overrides.expires_at ?? new Date(Date.now() + 60_000).toISOString(),
    decided_at: overrides.decided_at ?? null,
    executed_at: overrides.executed_at ?? null,
  };
}

const validBody = {
  agentId: "refund-agent-01",
  toolName: "issue_refund",
  actionType: "financial.refund",
  payload: {
    customerId: "cus_123",
    amount: 500_000,
    currency: "INR",
  },
  requestedBy: "support-agent",
};

function createProposeDeps(overrides: Partial<Parameters<typeof proposeAction>[3]> = {}) {
  let lastUpdated: ActionProposalRow | null = null;

  return {
    deps: {
      findActiveByHash: overrides.findActiveByHash ?? (async () => null),
      insertProposal:
        overrides.insertProposal ??
        (async (_supabase, params) =>
          buildProposalRow({
            action_hash: params.actionHash,
            action_payload: params.actionPayload,
          })),
      updatePolicyOutcome:
        overrides.updatePolicyOutcome ??
        (async (_supabase, params) => {
          lastUpdated = buildProposalRow({
            id: params.proposalId,
            organization_id: params.organizationId,
            status: params.status,
            policy_decision: params.policyDecision,
            risk_reasons: params.riskReasons,
            plain_english_summary: params.plainEnglishSummary ?? null,
            risk_level: params.riskLevel ?? "medium",
            risk_score: params.riskScore ?? 0,
            decided_at: params.decidedAt,
          });
          return lastUpdated;
        }),
      insertDecision: overrides.insertDecision ?? (async () => {}),
      evaluatePolicyRules: overrides.evaluatePolicyRules ?? evaluatePolicy,
      enrichProposal:
        overrides.enrichProposal ??
        (async () => ({
          ok: true as const,
          data: {
            plainEnglishSummary: "Advisory summary",
            riskScore: 20,
            riskLevel: "low" as const,
            riskSignals: ["test"],
            riskReasons: ["test reason"],
            reviewerAssistance: "Review if needed",
            model: "test-model",
          },
        })),
    },
    getLastUpdated: () => lastUpdated,
  };
}

describe("proposeActionSchema", () => {
  it("accepts a valid request body", () => {
    const parsed = proposeActionSchema.parse(validBody);
    assert.equal(parsed.agentId, "refund-agent-01");
    assert.equal(parsed.toolName, "issue_refund");
  });

  it("rejects an invalid body", () => {
    const result = proposeActionSchema.safeParse({
      agentId: "",
      toolName: "issue_refund",
      actionType: "financial.refund",
    });

    assert.equal(result.success, false);
  });

  it("rejects unexpected organization_id in body", () => {
    const result = proposeActionSchema.safeParse({
      ...validBody,
      organizationId: ORG_B,
    });

    assert.equal(result.success, false);
  });
});

describe("proposeAction service", () => {
  it("stores, evaluates policy, and returns ALLOW for small refund", async () => {
    const { deps } = createProposeDeps();

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.status, "allowed");
    assert.ok(result.matchedPolicies.some((policy) => policy.policyId === "demo-refund-allow-small"));
  });

  it("returns REVIEW for large refund proposals", async () => {
    const { deps } = createProposeDeps();

    const result = await proposeAction(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      {
        ...validBody,
        payload: { customerId: "cus_123", amount: 600_000, currency: "INR" },
      },
      deps
    );

    assert.equal(result.decision, "REVIEW");
    assert.equal(result.status, "review_required");
  });

  it("scopes proposals to the authenticated organization", async () => {
    let storedOrgId = "";
    const { deps } = createProposeDeps({
      insertProposal: async (_supabase, params) => {
        storedOrgId = params.organizationId;
        return buildProposalRow({ organization_id: params.organizationId });
      },
    });

    await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(storedOrgId, ORG_A);
    assert.notEqual(storedOrgId, ORG_B);
  });
});

describe("handleProposeActionRequest", () => {
  it("returns 201 for a valid authenticated request", async () => {
    const request = new Request("http://localhost/api/v1/actions/propose", {
      method: "POST",
      headers: {
        Authorization: "Bearer al_test_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validBody),
    });

    const response = await handleProposeActionRequest(request, {
      authenticate: async () => AUTH_CONTEXT,
      createAdmin: () => ({}) as SupabaseClient,
      propose: async () => ({
        proposalId: "44444444-4444-4444-8444-444444444444",
        status: "allowed",
        actionHash: "deadbeef",
        decision: "ALLOW",
        matchedPolicies: [],
      }),
    });

    assert.equal(response.status, 201);
    const payload = (await response.json()) as {
      proposalId: string;
      status: string;
      actionHash: string;
      decision: string;
    };
    assert.equal(payload.status, "allowed");
    assert.equal(payload.decision, "ALLOW");
    assert.ok(payload.proposalId);
    assert.ok(payload.actionHash);
  });

  it("returns 400 for an invalid body", async () => {
    const request = new Request("http://localhost/api/v1/actions/propose", {
      method: "POST",
      headers: {
        Authorization: "Bearer al_test_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agentId: "", toolName: "x", actionType: "y" }),
    });

    const response = await handleProposeActionRequest(request, {
      authenticate: async () => AUTH_CONTEXT,
      createAdmin: () => ({}) as SupabaseClient,
      propose: async () => {
        throw new Error("propose should not be called");
      },
    });

    assert.equal(response.status, 400);
  });

  it("returns 401 for an invalid API key", async () => {
    const request = new Request("http://localhost/api/v1/actions/propose", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validBody),
    });

    const response = await handleProposeActionRequest(request, {
      authenticate: async () => {
        throw new AgentAuthError("invalid_token");
      },
      createAdmin: () => ({}) as SupabaseClient,
      propose: async () => {
        throw new Error("propose should not be called");
      },
    });

    assert.equal(response.status, 401);
  });
});
