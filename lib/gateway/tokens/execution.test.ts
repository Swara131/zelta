import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentAuthError } from "@/lib/gateway/errors";
import { handleProposalStatusRequest } from "@/app/api/v1/actions/[proposalId]/status/route";
import { handleVerifyExecutionRequest } from "@/app/api/v1/actions/[proposalId]/verify-execution/route";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { computeActionHash } from "@/lib/gateway/proposals/canonicalize";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import {
  generateExecutionTokenMaterial,
  hashExecutionToken,
  verifyExecutionToken,
} from "@/lib/gateway/tokens/crypto";
import type { ExecutionTokenRow } from "@/lib/gateway/tokens/types";
import {
  getProposalExecutionStatus,
  resolveExternalProposalStatus,
  verifyProposalExecution,
  type ExecutionTokenDeps,
} from "@/lib/gateway/tokens/service";
import { applyReviewTimeoutIfExpired } from "@/lib/gateway/review/timeout";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_PROPOSAL_ID = "55555555-5555-5555-8555-555555555555";

const AUTH_CONTEXT: AgentAuthContext = {
  keyId: "key-1",
  organizationId: ORG_A,
  agentId: "refund-agent-01",
  keyPrefix: "al_test1234",
};

const validPayload = {
  customerId: "cus_123",
  amount: 500_000,
  currency: "INR",
};

const validBody = {
  agentId: "refund-agent-01",
  toolName: "issue_refund",
  actionType: "financial.refund",
  payload: validPayload,
};

const actionHash = computeActionHash({
  organizationId: ORG_A,
  agentId: validBody.agentId,
  toolName: validBody.toolName,
  actionType: validBody.actionType,
  payload: validPayload,
});

function buildProposalRow(
  overrides: Partial<ActionProposalRow> = {}
): ActionProposalRow {
  return {
    id: overrides.id ?? PROPOSAL_ID,
    organization_id: overrides.organization_id ?? ORG_A,
    agent_id: overrides.agent_id ?? "refund-agent-01",
    tool_name: overrides.tool_name ?? "issue_refund",
    action_type: overrides.action_type ?? "financial.refund",
    action_payload: overrides.action_payload ?? validPayload,
    action_hash: overrides.action_hash ?? actionHash,
    plain_english_summary: overrides.plain_english_summary ?? null,
    risk_level: overrides.risk_level ?? "medium",
    risk_score: overrides.risk_score ?? 20,
    risk_reasons: overrides.risk_reasons ?? [],
    policy_decision: overrides.policy_decision ?? "allow",
    status: overrides.status ?? "approved",
    requested_by: overrides.requested_by ?? null,
    idempotency_key: overrides.idempotency_key ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
    expires_at:
      overrides.expires_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    review_expires_at:
      overrides.review_expires_at ??
      (overrides.status === "review_required"
        ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
        : null),
    decided_at: overrides.decided_at ?? new Date().toISOString(),
    executed_at: overrides.executed_at ?? null,
  };
}

interface TokenStoreState {
  proposal: ActionProposalRow;
  tokens: ExecutionTokenRow[];
}

function createExecutionDeps(state: TokenStoreState): ExecutionTokenDeps {
  return {
    getProposal: async (_supabase, params) => {
      if (
        state.proposal.id !== params.proposalId ||
        state.proposal.organization_id !== params.organizationId
      ) {
        return null;
      }

      if (state.proposal.agent_id.trim() !== params.agentId.trim()) {
        throw new Error("agent mismatch");
      }

      return state.proposal;
    },
    getActiveToken: async (_supabase, params) => {
      const now = Date.now();
      return (
        state.tokens.find(
          (token) =>
            token.action_proposal_id === params.proposalId &&
            token.organization_id === params.organizationId &&
            token.status === "active" &&
            new Date(token.expires_at).getTime() > now
        ) ?? null
      );
    },
    insertToken: async (_supabase, params) => {
      const row: ExecutionTokenRow = {
        id: crypto.randomUUID(),
        organization_id: params.organizationId,
        action_proposal_id: params.actionProposalId,
        token_hash: params.tokenHash,
        token_prefix: params.tokenPrefix,
        status: "active",
        expires_at: params.expiresAt,
        used_at: null,
        revoked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.tokens.push(row);
      return row;
    },
    getTokenByHash: async (_supabase, tokenHash) =>
      state.tokens.find((token) => token.token_hash === tokenHash) ?? null,
    consumeToken: async (_supabase, params) => {
      const token = state.tokens.find(
        (item) =>
          item.token_hash === params.tokenHash &&
          item.action_proposal_id === params.proposalId &&
          item.organization_id === params.organizationId &&
          item.status === "active" &&
          new Date(item.expires_at).getTime() > new Date(params.consumedAt).getTime()
      );

      if (!token) {
        return null;
      }

      token.status = "used";
      token.used_at = params.consumedAt;
      token.updated_at = params.consumedAt;
      return { ...token };
    },
    markExecuted: async (_supabase, params) => {
      if (
        state.proposal.id !== params.proposalId ||
        state.proposal.organization_id !== params.organizationId ||
        state.proposal.action_hash !== params.actionHash ||
        state.proposal.executed_at ||
        state.proposal.status === "executed"
      ) {
        return null;
      }

      if (state.proposal.status !== "approved" && state.proposal.status !== "allowed") {
        return null;
      }

      state.proposal = {
        ...state.proposal,
        status: "executed",
        executed_at: params.executedAt,
        updated_at: params.executedAt,
      };

      return { ...state.proposal };
    },
    revertExecuted: async (_supabase, params) => {
      if (
        state.proposal.status === "executed" &&
        state.proposal.executed_at === params.executedAt
      ) {
        state.proposal = {
          ...state.proposal,
          status: params.priorStatus,
          executed_at: null,
          updated_at: params.executedAt,
        };
      }
    },
    revokeActiveTokens: async (_supabase, params) => {
      for (const token of state.tokens) {
        if (
          token.action_proposal_id === params.proposalId &&
          token.organization_id === params.organizationId &&
          token.status === "active"
        ) {
          token.status = "revoked";
          token.revoked_at = params.revokedAt;
          token.updated_at = params.revokedAt;
        }
      }
    },
    generateToken: generateExecutionTokenMaterial,
    hashToken: hashExecutionToken,
    verifyToken: verifyExecutionToken,
    computeHash: computeActionHash,
    applyReviewTimeout: async (_supabase, proposal) => ({
      row: proposal,
      outcome: "none" as const,
    }),
  };
}

function createAutoDenyReviewTimeout(state: TokenStoreState) {
  return async (_supabase: SupabaseClient, proposal: ActionProposalRow) =>
    applyReviewTimeoutIfExpired(_supabase, proposal, {
      timeoutBehavior: "auto_deny",
      deps: {
        autoDeny: async () => {
          state.proposal = {
            ...state.proposal,
            status: "rejected",
            decided_at: new Date().toISOString(),
          };
          return state.proposal;
        },
        insertDecision: async () => {},
        recordAudit: () => {},
        getProposal: async () => state.proposal,
        escalate: async () => null,
      },
    });
}

describe("execution token crypto", () => {
  it("generates tokens with et prefix and stores only hash", () => {
    const material = generateExecutionTokenMaterial();
    assert.ok(material.plainToken.startsWith("et_"));
    assert.ok(material.tokenHash.length === 64);
    assert.ok(verifyExecutionToken(material.plainToken, material.tokenHash));
  });
});

describe("resolveExternalProposalStatus", () => {
  it("maps review_required to pending", () => {
    const status = resolveExternalProposalStatus(
      buildProposalRow({ status: "review_required" })
    );
    assert.equal(status, "pending");
  });

  it("maps allowed to approved", () => {
    const status = resolveExternalProposalStatus(
      buildProposalRow({ status: "allowed" })
    );
    assert.equal(status, "approved");
  });

  it("maps expired proposal deadline to expired", () => {
    const status = resolveExternalProposalStatus(
      buildProposalRow({
        status: "approved",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    assert.equal(status, "expired");
  });

  it("maps executed proposals to executed", () => {
    const status = resolveExternalProposalStatus(
      buildProposalRow({
        status: "executed",
        executed_at: new Date().toISOString(),
      })
    );
    assert.equal(status, "executed");
  });
});

describe("getProposalExecutionStatus", () => {
  it("issues a raw token once for approved proposals", async () => {
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [],
    };
    const deps = createExecutionDeps(state);

    const first = await getProposalExecutionStatus(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      deps
    );

    assert.equal(first.status, "approved");
    assert.ok(first.executionToken);
    assert.ok(first.executionTokenExpiresAt);

    const second = await getProposalExecutionStatus(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      deps
    );

    assert.equal(second.executionToken, undefined);
    assert.equal(second.executionTokenIssued, true);
  });

  it("does not issue tokens for pending proposals", async () => {
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "review_required" }),
      tokens: [],
    };

    const result = await getProposalExecutionStatus(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      createExecutionDeps(state)
    );

    assert.equal(result.status, "pending");
    assert.equal(result.executionToken, undefined);
    assert.equal(state.tokens.length, 0);
  });

  it("auto-denies expired review and never issues a token", async () => {
    const state: TokenStoreState = {
      proposal: buildProposalRow({
        status: "review_required",
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
      }),
      tokens: [],
    };
    const deps = createExecutionDeps(state);
    deps.applyReviewTimeout = createAutoDenyReviewTimeout(state);

    const result = await getProposalExecutionStatus(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      deps
    );

    assert.equal(result.status, "rejected");
    assert.equal(state.proposal.status, "rejected");
    assert.equal(result.executionToken, undefined);
    assert.equal(state.tokens.length, 0);
  });

  it("maps review_required past review deadline to pending before timeout processing", () => {
    const status = resolveExternalProposalStatus(
      buildProposalRow({
        status: "review_required",
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
    );
    assert.equal(status, "pending");
  });
});

describe("verifyProposalExecution", () => {
  it("accepts a valid token and payload", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const result = await verifyProposalExecution(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      {
        executionToken: material.plainToken,
        toolName: validBody.toolName,
        actionType: validBody.actionType,
        payload: validPayload,
      },
      createExecutionDeps(state)
    );

    assert.equal(result.allowed, true);
    assert.equal(result.actionHash, actionHash);
    assert.equal(state.tokens[0]!.status, "used");
    assert.equal(state.proposal.status, "executed");
    assert.ok(state.proposal.executed_at);
  });

  it("rejects expired tokens", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() - 1000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "expired");
        return true;
      }
    );
  });

  it("rejects replayed tokens", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "used",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: new Date().toISOString(),
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "replayed");
        return true;
      }
    );
  });

  it("rejects wrong proposal id", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: OTHER_PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "proposal_mismatch");
        return true;
      }
    );
  });

  it("rejects changed amount in payload", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: { ...validPayload, amount: 600_000 },
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "payload_mismatch");
        return true;
      }
    );
  });

  it("rejects changed payload shape", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: { customerId: "cus_999", amount: 500_000, currency: "INR" },
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "payload_mismatch");
        return true;
      }
    );
  });

  it("rejects changed tool name", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: "delete_database",
            actionType: validBody.actionType,
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "tool_mismatch");
        return true;
      }
    );
  });

  it("rejects changed action type", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: "financial.transfer",
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "action_type_mismatch");
        return true;
      }
    );
  });

  it("rejects wrong organization", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_B,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: material.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: validPayload,
          },
          createExecutionDeps(state)
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "organization_mismatch");
        return true;
      }
    );
  });

  it("rejects concurrent double-use attempts", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const deps = createExecutionDeps(state);
    const input = {
      executionToken: material.plainToken,
      toolName: validBody.toolName,
      actionType: validBody.actionType,
      payload: validPayload,
    };

    await verifyProposalExecution(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      input,
      deps
    );

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          input,
          deps
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "not_eligible");
        return true;
      }
    );
  });

  it("does not issue another token after successful execution", async () => {
    const material = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: material.tokenHash,
          token_prefix: material.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const deps = createExecutionDeps(state);

    await verifyProposalExecution(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      {
        executionToken: material.plainToken,
        toolName: validBody.toolName,
        actionType: validBody.actionType,
        payload: validPayload,
      },
      deps
    );

    const status = await getProposalExecutionStatus(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      deps
    );

    assert.equal(status.status, "executed");
    assert.equal(status.executionToken, undefined);
    assert.equal(status.executionTokenIssued, undefined);
    assert.equal(state.tokens.filter((token) => token.status === "active").length, 0);
  });

  it("prevents concurrent verification with a second active token", async () => {
    const materialOne = generateExecutionTokenMaterial();
    const materialTwo = generateExecutionTokenMaterial();
    const state: TokenStoreState = {
      proposal: buildProposalRow({ status: "approved" }),
      tokens: [
        {
          id: "token-1",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: materialOne.tokenHash,
          token_prefix: materialOne.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "token-2",
          organization_id: ORG_A,
          action_proposal_id: PROPOSAL_ID,
          token_hash: materialTwo.tokenHash,
          token_prefix: materialTwo.tokenPrefix,
          status: "active",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          used_at: null,
          revoked_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const deps = createExecutionDeps(state);

    await verifyProposalExecution(
      {} as SupabaseClient,
      AUTH_CONTEXT,
      PROPOSAL_ID,
      {
        executionToken: materialOne.plainToken,
        toolName: validBody.toolName,
        actionType: validBody.actionType,
        payload: validPayload,
      },
      deps
    );

    await assert.rejects(
      () =>
        verifyProposalExecution(
          {} as SupabaseClient,
          AUTH_CONTEXT,
          PROPOSAL_ID,
          {
            executionToken: materialTwo.plainToken,
            toolName: validBody.toolName,
            actionType: validBody.actionType,
            payload: validPayload,
          },
          deps
        ),
      (err: Error & { code?: string }) => {
        assert.equal(err.code, "not_eligible");
        return true;
      }
    );

    assert.equal(state.proposal.status, "executed");
    assert.equal(state.tokens[1]!.status, "revoked");
  });
});

describe("handleProposalStatusRequest", () => {
  it("returns approved status with execution token for eligible proposals", async () => {
    const request = new Request(
      `http://localhost/api/v1/actions/${PROPOSAL_ID}/status`,
      {
        headers: { Authorization: "Bearer al_test_key" },
      }
    );

    const response = await handleProposalStatusRequest(request, PROPOSAL_ID, {
      authenticate: async () => AUTH_CONTEXT,
      createAdmin: () => ({}) as SupabaseClient,
      getStatus: async () => ({
        proposalId: PROPOSAL_ID,
        status: "approved",
        actionHash,
        executionToken: "et_test_token",
        executionTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        executionTokenIssued: true,
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      status: string;
      executionToken?: string;
    };
    assert.equal(payload.status, "approved");
    assert.equal(payload.executionToken, "et_test_token");
  });

  it("returns 401 for invalid API key", async () => {
    const request = new Request(
      `http://localhost/api/v1/actions/${PROPOSAL_ID}/status`,
      {
        headers: { Authorization: "Bearer invalid" },
      }
    );

    const response = await handleProposalStatusRequest(request, PROPOSAL_ID, {
      authenticate: async () => {
        throw new AgentAuthError("invalid_token");
      },
      createAdmin: () => ({}) as SupabaseClient,
      getStatus: async () => {
        throw new Error("should not run");
      },
    });

    assert.equal(response.status, 401);
  });
});

describe("handleVerifyExecutionRequest", () => {
  it("returns execution permission for valid verification", async () => {
    const request = new Request(
      `http://localhost/api/v1/actions/${PROPOSAL_ID}/verify-execution`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer al_test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          executionToken: "et_test_token",
          toolName: validBody.toolName,
          actionType: validBody.actionType,
          payload: validPayload,
        }),
      }
    );

    const response = await handleVerifyExecutionRequest(request, PROPOSAL_ID, {
      authenticate: async () => AUTH_CONTEXT,
      createAdmin: () => ({}) as SupabaseClient,
      verify: async () => ({
        allowed: true,
        proposalId: PROPOSAL_ID,
        actionHash,
        consumedAt: new Date().toISOString(),
      }),
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { allowed: boolean };
    assert.equal(payload.allowed, true);
  });
});
