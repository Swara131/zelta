import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentAuthError, ProposalError } from "@/lib/gateway/errors";
import { handleProposeActionRequest } from "@/app/api/v1/actions/propose/route";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import { proposeActionSchema } from "@/lib/security/validation";
import type { ShadowRiskAssessment } from "@/lib/gateway/risk/assessment";
import {
  ShadowRiskClassifierError,
  SHADOW_CLASSIFIER_VERSION,
} from "@/lib/gateway/risk/classifier";
import type { StoredShadowRiskRecord } from "@/lib/gateway/risk/shadow-store";
import { SHADOW_RISK_MODE } from "@/lib/gateway/risk/shadow-store";
import type { ActionProposalRow } from "./repository";
import { computeActionHash } from "./canonicalize";
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
    review_expires_at:
      overrides.review_expires_at ??
      (overrides.status === "review_required"
        ? new Date(Date.now() + 60_000).toISOString()
        : null),
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

const blockBody = {
  agentId: "refund-agent-01",
  toolName: "delete_database",
  actionType: "database.delete",
  payload: {
    resourceType: "database",
    destructiveOperation: true,
    productionTarget: true,
    databaseId: "prod-main",
  },
  requestedBy: "ops-agent",
};

function buildShadowAssessment(
  overrides: Partial<ShadowRiskAssessment> = {}
): ShadowRiskAssessment {
  return {
    riskLevel: "high",
    score: 85,
    confidence: 0.92,
    reasons: ["shadow advisory reason"],
    signals: [
      {
        code: "shadow.test",
        description: "Test shadow signal",
        severity: "high",
      },
    ],
    recommendedDecision: "review",
    modelProvider: "groq",
    modelName: "test-shadow-model",
    classifierVersion: SHADOW_CLASSIFIER_VERSION,
    ...overrides,
  };
}

function createProposeDeps(overrides: Partial<Parameters<typeof proposeAction>[3]> = {}) {
  let lastUpdated: ActionProposalRow | null = null;
  let lastInsertedActionHash: string | null = null;
  let lastShadowMerge: {
    proposalId: string;
    organizationId: string;
    actionHash: string;
    shadow: StoredShadowRiskRecord;
  } | null = null;

  return {
    deps: {
      findActiveByHash: overrides.findActiveByHash ?? (async () => null),
      findByIdempotencyKey: overrides.findByIdempotencyKey ?? (async () => null),
      insertProposal:
        overrides.insertProposal ??
        (async (_supabase, params) => {
          lastInsertedActionHash = params.actionHash;
          return buildProposalRow({
            action_hash: params.actionHash,
            action_payload: params.actionPayload,
          });
        }),
      updatePolicyOutcome:
        overrides.updatePolicyOutcome ??
        (async (_supabase, params) => {
          lastUpdated = buildProposalRow({
            id: params.proposalId,
            organization_id: params.organizationId,
            action_hash: lastInsertedActionHash ?? "abc123",
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
      classifyShadowRisk:
        overrides.classifyShadowRisk ??
        (async () => buildShadowAssessment({ recommendedDecision: "review" })),
      mergeProposalShadowRisk:
        overrides.mergeProposalShadowRisk ??
        (async (_supabase, params) => {
          lastShadowMerge = params;
        }),
    },
    getLastUpdated: () => lastUpdated,
    getLastShadowMerge: () => lastShadowMerge,
  };
}

function idempotencyStoreKey(
  organizationId: string,
  agentId: string,
  idempotencyKey: string
): string {
  return `${organizationId}:${agentId.trim()}:${idempotencyKey}`;
}

function createIdempotencyHarness() {
  const byIdempotencyKey = new Map<string, ActionProposalRow>();
  let insertCount = 0;
  let insertInFlight: Promise<void> = Promise.resolve();

  const actionHashFor = (body: typeof validBody) =>
    computeActionHash({
      organizationId: ORG_A,
      agentId: body.agentId,
      toolName: body.toolName,
      actionType: body.actionType,
      payload: body.payload,
    });

  const { deps } = createProposeDeps({
    findByIdempotencyKey: async (_supabase, params) =>
      byIdempotencyKey.get(
        idempotencyStoreKey(
          params.organizationId,
          params.agentId,
          params.idempotencyKey
        )
      ) ?? null,
    findActiveByHash: async (_supabase, params) => {
      for (const row of byIdempotencyKey.values()) {
        if (
          row.organization_id === params.organizationId &&
          row.action_hash === params.actionHash &&
          ["pending", "allowed", "review_required", "approved"].includes(row.status)
        ) {
          return row;
        }
      }
      return null;
    },
    insertProposal: async (_supabase, params) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });

      const prior = insertInFlight;
      insertInFlight = prior.then(async () => {
        await gate;
      });

      await prior;

      try {
        if (params.idempotencyKey) {
          const key = idempotencyStoreKey(
            params.organizationId,
            params.agentId,
            params.idempotencyKey
          );
          const existing = byIdempotencyKey.get(key);
          if (existing) {
            throw new ProposalError(
              "duplicate key value violates unique constraint",
              "storage_error",
              "23505"
            );
          }
        }

        insertCount += 1;

        const row = buildProposalRow({
          id: crypto.randomUUID(),
          organization_id: params.organizationId,
          agent_id: params.agentId,
          tool_name: params.toolName,
          action_type: params.actionType,
          action_payload: params.actionPayload,
          action_hash: params.actionHash,
          idempotency_key: params.idempotencyKey ?? null,
          status: "pending",
          policy_decision: null,
        });

        if (params.idempotencyKey) {
          byIdempotencyKey.set(
            idempotencyStoreKey(
              params.organizationId,
              params.agentId,
              params.idempotencyKey
            ),
            row
          );
        }

        return row;
      } finally {
        release();
      }
    },
    updatePolicyOutcome: async (_supabase, params) => {
      const row = [...byIdempotencyKey.values()].find(
        (item) => item.id === params.proposalId
      );

      const updated = buildProposalRow({
        ...(row ?? buildProposalRow()),
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

      if (updated.idempotency_key) {
        byIdempotencyKey.set(
          idempotencyStoreKey(
            updated.organization_id,
            updated.agent_id,
            updated.idempotency_key
          ),
          updated
        );
      }

      return updated;
    },
  });

  return {
    deps,
    getInsertCount: () => insertCount,
    actionHashFor,
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

describe("proposeAction shadow risk (observational only)", () => {
  it("keeps deterministic ALLOW when shadow recommends review", async () => {
    const { deps, getLastShadowMerge } = createProposeDeps({
      classifyShadowRisk: async () =>
        buildShadowAssessment({ recommendedDecision: "review", riskLevel: "high" }),
    });

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.status, "allowed");

    const shadow = getLastShadowMerge()?.shadow;
    assert.ok(shadow);
    assert.equal(shadow!.mode, SHADOW_RISK_MODE);
    assert.equal(shadow!.status, "completed");
    assert.equal(shadow!.policyDecision, "ALLOW");
    if (shadow!.status === "completed") {
      assert.equal(shadow!.assessment.recommendedDecision, "review");
    }
  });

  it("keeps deterministic REVIEW when shadow recommends allow", async () => {
    const { deps, getLastShadowMerge } = createProposeDeps({
      classifyShadowRisk: async () =>
        buildShadowAssessment({ recommendedDecision: "allow", riskLevel: "low", score: 10 }),
    });

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

    const shadow = getLastShadowMerge()?.shadow;
    assert.ok(shadow);
    assert.equal(shadow!.policyDecision, "REVIEW");
    if (shadow!.status === "completed") {
      assert.equal(shadow!.assessment.recommendedDecision, "allow");
    }
  });

  it("keeps deterministic BLOCK regardless of shadow output", async () => {
    const { deps, getLastShadowMerge } = createProposeDeps({
      classifyShadowRisk: async () =>
        buildShadowAssessment({ recommendedDecision: "allow", riskLevel: "low", score: 5 }),
    });

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, blockBody, deps);

    assert.equal(result.decision, "BLOCK");
    assert.equal(result.status, "blocked");

    const shadow = getLastShadowMerge()?.shadow;
    assert.ok(shadow);
    assert.equal(shadow!.policyDecision, "BLOCK");
  });

  it("does not break proposal creation when shadow classifier times out", async () => {
    const { deps, getLastShadowMerge } = createProposeDeps({
      classifyShadowRisk: async () => {
        throw new ShadowRiskClassifierError("timeout", "Shadow classifier timed out.");
      },
    });

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(result.decision, "ALLOW");
    assert.equal(result.status, "allowed");

    const shadow = getLastShadowMerge()?.shadow;
    assert.ok(shadow);
    assert.equal(shadow!.status, "failed");
    if (shadow!.status === "failed") {
      assert.equal(shadow!.failure.code, "timeout");
    }
  });

  it("does not break proposal creation when shadow classifier fails", async () => {
    const { deps, getLastShadowMerge } = createProposeDeps({
      classifyShadowRisk: async () => {
        throw new ShadowRiskClassifierError("provider_failure", "Groq unavailable.");
      },
    });

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(result.decision, "ALLOW");
    assert.ok(result.proposalId);

    const shadow = getLastShadowMerge()?.shadow;
    assert.ok(shadow);
    assert.equal(shadow!.status, "failed");
    if (shadow!.status === "failed") {
      assert.equal(shadow!.failure.code, "provider_failure");
    }
  });

  it("binds shadow assessment to the exact action_hash", async () => {
    const expectedHash = computeActionHash({
      organizationId: ORG_A,
      agentId: validBody.agentId,
      toolName: validBody.toolName,
      actionType: validBody.actionType,
      payload: validBody.payload,
    });

    const { deps, getLastShadowMerge } = createProposeDeps();

    const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

    assert.equal(result.actionHash, expectedHash);

    const merge = getLastShadowMerge();
    assert.ok(merge);
    assert.equal(merge!.actionHash, expectedHash);
    assert.equal(merge!.shadow.actionHash, expectedHash);
    assert.equal(merge!.shadow.proposalId, result.proposalId);
    assert.equal(merge!.shadow.classifierVersion, SHADOW_CLASSIFIER_VERSION);
    assert.ok(merge!.shadow.assessedAt);
  });
});

describe("proposeAction risk enforcement mode", () => {
  async function withRiskEnv<T>(
    env: { enforcement?: string; failsafe?: string },
    fn: () => Promise<T>
  ): Promise<T> {
    const originalEnforcement = process.env.RISK_ENFORCEMENT_MODE;
    const originalFailsafe = process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
    try {
      if (env.enforcement === undefined) {
        delete process.env.RISK_ENFORCEMENT_MODE;
      } else {
        process.env.RISK_ENFORCEMENT_MODE = env.enforcement;
      }
      if (env.failsafe === undefined) {
        delete process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
      } else {
        process.env.RISK_FAILSAFE_ON_UNAVAILABLE = env.failsafe;
      }
      return await fn();
    } finally {
      if (originalEnforcement === undefined) {
        delete process.env.RISK_ENFORCEMENT_MODE;
      } else {
        process.env.RISK_ENFORCEMENT_MODE = originalEnforcement;
      }
      if (originalFailsafe === undefined) {
        delete process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
      } else {
        process.env.RISK_FAILSAFE_ON_UNAVAILABLE = originalFailsafe;
      }
    }
  }

  it("escalates deterministic ALLOW to REVIEW in enforce mode for high shadow risk", async () => {
    await withRiskEnv({ enforcement: "enforce" }, async () => {
      const { deps, getLastUpdated } = createProposeDeps({
        classifyShadowRisk: async () =>
          buildShadowAssessment({ recommendedDecision: "review", riskLevel: "high" }),
      });

      const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

      assert.equal(result.decision, "REVIEW");
      assert.equal(result.status, "review_required");

      const updated = getLastUpdated();
      assert.ok(updated);
      const riskReasons = updated!.risk_reasons as {
        decisionComposition?: {
          deterministicDecision: string;
          finalDecision: string;
          escalated: boolean;
          actionHash: string;
        };
      };
      assert.ok(riskReasons.decisionComposition);
      assert.equal(riskReasons.decisionComposition!.deterministicDecision, "ALLOW");
      assert.equal(riskReasons.decisionComposition!.finalDecision, "REVIEW");
      assert.equal(riskReasons.decisionComposition!.escalated, true);
      assert.equal(riskReasons.decisionComposition!.actionHash, result.actionHash);
    });
  });

  it("preserves deterministic BLOCK in enforce mode even when shadow recommends review", async () => {
    await withRiskEnv({ enforcement: "enforce" }, async () => {
      const { deps, getLastUpdated } = createProposeDeps({
        classifyShadowRisk: async () =>
          buildShadowAssessment({ recommendedDecision: "review", riskLevel: "critical" }),
      });

      const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, blockBody, deps);

      assert.equal(result.decision, "BLOCK");
      assert.equal(result.status, "blocked");

      const updated = getLastUpdated();
      const riskReasons = updated!.risk_reasons as {
        decisionComposition?: { finalDecision: string; escalated: boolean };
      };
      assert.equal(riskReasons.decisionComposition?.finalDecision, "BLOCK");
      assert.equal(riskReasons.decisionComposition?.escalated, false);
    });
  });

  it("preserves deterministic REVIEW in enforce mode when shadow recommends allow", async () => {
    await withRiskEnv({ enforcement: "enforce" }, async () => {
      const { deps } = createProposeDeps({
        classifyShadowRisk: async () =>
          buildShadowAssessment({ recommendedDecision: "allow", riskLevel: "low", score: 5 }),
      });

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
  });

  it("uses preserve fail-safe when classifier unavailable in enforce mode", async () => {
    await withRiskEnv({ enforcement: "enforce", failsafe: "preserve" }, async () => {
      const { deps } = createProposeDeps({
        classifyShadowRisk: async () => {
          throw new ShadowRiskClassifierError("timeout", "timed out");
        },
      });

      const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

      assert.equal(result.decision, "ALLOW");
      assert.equal(result.status, "allowed");
    });
  });

  it("escalates to REVIEW when classifier unavailable and fail-safe is review", async () => {
    await withRiskEnv({ enforcement: "enforce", failsafe: "review" }, async () => {
      const { deps } = createProposeDeps({
        classifyShadowRisk: async () => {
          throw new ShadowRiskClassifierError("timeout", "timed out");
        },
      });

      const result = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, validBody, deps);

      assert.equal(result.decision, "REVIEW");
      assert.equal(result.status, "review_required");
    });
  });
});

describe("proposeAction idempotency", () => {
  it("returns the same proposal for the same key and payload", async () => {
    const { deps } = createIdempotencyHarness();
    const body = {
      ...validBody,
      idempotencyKey: "refund-attempt-001",
    };

    const first = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, body, deps);
    const second = await proposeAction({} as SupabaseClient, AUTH_CONTEXT, body, deps);

    assert.equal(second.proposalId, first.proposalId);
    assert.equal(second.actionHash, first.actionHash);
    assert.equal(second.decision, first.decision);
  });

  it("rejects the same key with a different payload", async () => {
    const { deps } = createIdempotencyHarness();
    const idempotencyKey = "refund-attempt-002";

    await proposeAction(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      { ...validBody, idempotencyKey },
      deps
    );

    await assert.rejects(
      () =>
        proposeAction(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          {
            ...validBody,
            idempotencyKey,
            payload: { customerId: "cus_999", amount: 500_000, currency: "INR" },
          },
          deps
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "idempotency_conflict");
        return true;
      }
    );
  });

  it("allows different agents to use the same idempotency key independently", async () => {
    const { deps } = createIdempotencyHarness();
    const idempotencyKey = "shared-key-001";

    const agentA = await proposeAction(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      { ...validBody, idempotencyKey },
      deps
    );

    const agentBContext: AgentAuthContext = {
      ...AUTH_CONTEXT,
      agentId: "refund-agent-02",
    };

    const agentB = await proposeAction(
      {} as SupabaseClient,
      agentBContext,
      {
        ...validBody,
        agentId: "refund-agent-02",
        idempotencyKey,
      },
      deps
    );

    assert.notEqual(agentB.proposalId, agentA.proposalId);
  });

  it("does not create duplicate proposals on concurrent retries", async () => {
    const { deps, getInsertCount } = createIdempotencyHarness();
    const body = {
      ...validBody,
      idempotencyKey: "refund-attempt-concurrent",
    };

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        proposeAction({} as SupabaseClient, AUTH_CONTEXT, body, deps)
      )
    );

    const proposalIds = new Set(results.map((result) => result.proposalId));
    assert.equal(proposalIds.size, 1);
    assert.equal(getInsertCount(), 1);
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

  it("returns 409 for idempotency payload conflicts", async () => {
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
      propose: async () => {
        throw new ProposalError(
          "Idempotency key was already used with a different action.",
          "idempotency_conflict"
        );
      },
    });

    assert.equal(response.status, 409);
    const payload = (await response.json()) as { code?: string };
    assert.equal(payload.code, "idempotency_conflict");
  });
});
