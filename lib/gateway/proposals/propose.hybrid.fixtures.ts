import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAuthContext } from "@/lib/gateway/types";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import type { ShadowRiskAssessment } from "@/lib/gateway/risk/assessment";
import { SHADOW_CLASSIFIER_VERSION } from "@/lib/gateway/risk/classifier";
import type { StoredShadowRiskRecord } from "@/lib/gateway/risk/shadow-store";
import {
  generateExecutionTokenMaterial,
  hashExecutionToken,
  verifyExecutionToken,
} from "@/lib/gateway/tokens/crypto";
import type { ExecutionTokenDeps } from "@/lib/gateway/tokens/service";
import type { ExecutionTokenRow } from "@/lib/gateway/tokens/types";
import type { HumanDecisionDeps } from "./human-decision";
import type { ActionProposalRow } from "./repository";
import { computeActionHash } from "./canonicalize";
import { proposeAction } from "./service";
import { ProposalError } from "@/lib/gateway/errors";
import {
  applyReviewTimeoutIfExpired,
  ensureReviewFreshOrProcessed,
} from "@/lib/gateway/review/timeout";

export const ORG_A = "11111111-1111-4111-8111-111111111111";
export const ACTOR_ID = "77777777-7777-4777-8777-777777777777";
export const SUPABASE = {} as SupabaseClient;

export const AUTH_CONTEXT: AgentAuthContext = {
  keyId: "key-1",
  organizationId: ORG_A,
  agentId: "refund-agent-01",
  keyPrefix: "al_test1234",
};

export const validBody = {
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

export const blockBody = {
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

export const HYBRID_THRESHOLD = 0.7;

export const actionHash = computeActionHash({
  organizationId: ORG_A,
  agentId: validBody.agentId,
  toolName: validBody.toolName,
  actionType: validBody.actionType,
  payload: validBody.payload,
});

export function buildProposalRow(
  overrides: Partial<ActionProposalRow> = {}
): ActionProposalRow {
  return {
    id: overrides.id ?? "44444444-4444-4444-8444-444444444444",
    organization_id: overrides.organization_id ?? ORG_A,
    agent_id: overrides.agent_id ?? "refund-agent-01",
    tool_name: overrides.tool_name ?? "issue_refund",
    action_type: overrides.action_type ?? "financial.refund",
    action_payload: overrides.action_payload ?? validBody.payload,
    action_hash: overrides.action_hash ?? actionHash,
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
      overrides.expires_at ?? new Date(Date.now() + 86_400_000).toISOString(),
    review_expires_at:
      overrides.review_expires_at ??
      (overrides.status === "review_required"
        ? new Date(Date.now() + 86_400_000).toISOString()
        : null),
    decided_at: overrides.decided_at ?? null,
    executed_at: overrides.executed_at ?? null,
  };
}

export function buildShadowAssessment(
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

export type StoredComposition = {
  decisionComposition?: {
    deterministicDecision: string;
    finalDecision: string;
    escalated: boolean;
    enforcementMode: string;
    actionHash: string;
  };
};

export function readComposition(
  row: ActionProposalRow
): StoredComposition["decisionComposition"] {
  return (row.risk_reasons as StoredComposition).decisionComposition;
}

export async function withHybridEnv<T>(
  env: { threshold?: string; failsafe?: string },
  fn: () => Promise<T>
): Promise<T> {
  const originalEnforcement = process.env.RISK_ENFORCEMENT_MODE;
  const originalThreshold = process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD;
  const originalFailsafe = process.env.RISK_FAILSAFE_ON_UNAVAILABLE;

  try {
    process.env.RISK_ENFORCEMENT_MODE = "hybrid";
    if (env.threshold === undefined) {
      process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD = String(HYBRID_THRESHOLD);
    } else {
      process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD = env.threshold;
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
    if (originalThreshold === undefined) {
      delete process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD;
    } else {
      process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD = originalThreshold;
    }
    if (originalFailsafe === undefined) {
      delete process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
    } else {
      process.env.RISK_FAILSAFE_ON_UNAVAILABLE = originalFailsafe;
    }
  }
}

export function createHybridProposeHarness(options: {
  classifyShadowRisk?: () => Promise<ShadowRiskAssessment>;
  onClassifierCall?: () => void;
}) {
  let proposal: ActionProposalRow | null = null;
  let insertedActionHash: string | null = null;
  let insertCalled = false;
  let updateCalled = false;

  const deps = {
    findActiveByHash: async () => null,
    findByIdempotencyKey: async () => null,
    insertProposal: async (
      _supabase: SupabaseClient,
      params: {
        organizationId: string;
        agentId: string;
        toolName: string;
        actionType: string;
        actionPayload: Record<string, unknown>;
        actionHash: string;
      }
    ) => {
      insertCalled = true;
      insertedActionHash = params.actionHash;
      proposal = buildProposalRow({
        action_hash: params.actionHash,
        action_payload: params.actionPayload,
        tool_name: params.toolName,
        action_type: params.actionType,
        status: "pending",
      });
      return proposal;
    },
    updatePolicyOutcome: async (
      _supabase: SupabaseClient,
      params: {
        proposalId: string;
        organizationId: string;
        status: ActionProposalRow["status"];
        policyDecision: ActionProposalRow["policy_decision"];
        riskReasons: unknown;
        decidedAt: string;
        reviewExpiresAt?: string | null;
        plainEnglishSummary?: string | null;
        riskLevel?: string;
        riskScore?: number;
      }
    ) => {
      updateCalled = true;
      proposal = buildProposalRow({
        ...(proposal ?? buildProposalRow()),
        id: params.proposalId,
        organization_id: params.organizationId,
        action_hash: insertedActionHash ?? actionHash,
        status: params.status,
        policy_decision: params.policyDecision,
        risk_reasons: params.riskReasons,
        plain_english_summary: params.plainEnglishSummary ?? null,
        risk_level: params.riskLevel ?? "medium",
        risk_score: params.riskScore ?? 0,
        decided_at: params.decidedAt,
        review_expires_at: params.reviewExpiresAt ?? null,
      });
      return proposal;
    },
    insertDecision: async () => {},
    evaluatePolicyRules: evaluatePolicy,
    enrichProposal: async () => ({
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
    }),
    classifyShadowRisk: async () => {
      options.onClassifierCall?.();
      if (options.classifyShadowRisk) {
        return options.classifyShadowRisk();
      }
      return buildShadowAssessment({ recommendedDecision: "review" });
    },
    mergeProposalShadowRisk: async (
      _supabase: SupabaseClient,
      params: {
        proposalId: string;
        organizationId: string;
        actionHash: string;
        shadow: StoredShadowRiskRecord;
      }
    ) => {
      assert.equal(params.actionHash, insertedActionHash);
      assert.equal(params.proposalId, proposal?.id);
    },
  };

  return {
    deps,
    getProposal: () => {
      assert.ok(proposal, "expected proposal to be persisted");
      return proposal!;
    },
    wasPersisted: () => insertCalled && updateCalled,
  };
}

export function createTokenDeps(state: {
  proposal: ActionProposalRow;
  tokens: ExecutionTokenRow[];
}): ExecutionTokenDeps {
  return {
    getProposal: async (_supabase, params) => {
      if (
        state.proposal.id !== params.proposalId ||
        state.proposal.organization_id !== params.organizationId ||
        state.proposal.agent_id.trim() !== params.agentId.trim()
      ) {
        return null;
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
    revertExecuted: async () => {},
    revokeActiveTokens: async () => {},
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

export function createHumanDecisionDeps(state: {
  proposal: ActionProposalRow;
}): HumanDecisionDeps {
  return {
    ensureFresh: async () => state.proposal,
    finalizeDecision: async (_client, params) => {
      state.proposal = {
        ...state.proposal,
        status: params.status,
        decided_at: params.decidedAt,
        action_hash: params.actionHash,
      };
      return state.proposal;
    },
    insertDecision: async () => {},
    recordRuntimeAudit: () => {},
    recordRetrospectiveAudit: async () => {},
    listReviews: async () =>
      state.proposal.status === "review_required" ? [state.proposal] : [],
    getProposal: async () => state.proposal,
  };
}

export function createHumanDecisionDepsWithTimeout(state: {
  proposal: ActionProposalRow;
}): HumanDecisionDeps {
  const reviewTimeoutDeps = {
    getProposal: async () => state.proposal,
    autoDeny: async () => {
      state.proposal = {
        ...state.proposal,
        status: "rejected",
        decided_at: new Date().toISOString(),
      };
      return state.proposal;
    },
    escalate: async () => null,
    insertDecision: async () => {},
    recordAudit: () => {},
  };

  return {
    ensureFresh: async (supabase, params, options) =>
      ensureReviewFreshOrProcessed(supabase, params, {
        deps: reviewTimeoutDeps,
      }),
    finalizeDecision: async (_client, params) => {
      if (
        new Date(state.proposal.review_expires_at ?? state.proposal.expires_at) <=
        new Date(params.decidedAt)
      ) {
        throw new ProposalError(
          "Proposal not found, already decided, review deadline expired, or action hash mismatch."
        );
      }
      state.proposal = {
        ...state.proposal,
        status: params.status,
        decided_at: params.decidedAt,
        action_hash: params.actionHash,
      };
      return state.proposal;
    },
    insertDecision: async () => {},
    recordRuntimeAudit: () => {},
    recordRetrospectiveAudit: async () => {},
    listReviews: async () =>
      state.proposal.status === "review_required" ? [state.proposal] : [],
    getProposal: async () => state.proposal,
    reviewTimeoutDeps,
  };
}

export function createTokenDepsWithReviewTimeout(state: {
  proposal: ActionProposalRow;
  tokens: ExecutionTokenRow[];
}): ExecutionTokenDeps {
  const base = createTokenDeps(state);
  return {
    ...base,
    applyReviewTimeout: async (_supabase, proposal) => {
      const result = await applyReviewTimeoutIfExpired(_supabase, proposal, {
        timeoutBehavior: "auto_deny",
        deps: {
          getProposal: async () => state.proposal,
          autoDeny: async () => {
            state.proposal = {
              ...state.proposal,
              status: "rejected",
              decided_at: new Date().toISOString(),
            };
            return state.proposal;
          },
          escalate: async () => null,
          insertDecision: async () => {},
          recordAudit: () => {},
        },
      });
      state.proposal = result.row;
      return result;
    },
  };
}

export async function proposeHybridEscalatedReview(): Promise<{
  harness: ReturnType<typeof createHybridProposeHarness>;
  proposeResult: Awaited<ReturnType<typeof proposeAction>>;
  tokenState: { proposal: ActionProposalRow; tokens: ExecutionTokenRow[] };
}> {
  const harness = createHybridProposeHarness({
    classifyShadowRisk: async () =>
      buildShadowAssessment({
        riskLevel: "high",
        confidence: 0.85,
        recommendedDecision: "review",
      }),
  });

  const proposeResult = await proposeAction(
    SUPABASE,
    AUTH_CONTEXT,
    validBody,
    harness.deps
  );

  return {
    harness,
    proposeResult,
    tokenState: { proposal: harness.getProposal(), tokens: [] },
  };
}

export const hybridVerifyInput = {
  toolName: validBody.toolName,
  actionType: validBody.actionType,
  payload: validBody.payload,
};
