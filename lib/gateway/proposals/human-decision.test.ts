import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/gateway/errors";
import type { ActionProposalRow } from "./repository";
import {
  decideGatewayProposalReview,
  type HumanDecisionDeps,
} from "./human-decision";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_ID = "77777777-7777-4777-8777-777777777777";
const SUPABASE = {} as SupabaseClient;

function buildReviewRow(overrides: Partial<ActionProposalRow> = {}): ActionProposalRow {
  return {
    id: PROPOSAL_ID,
    organization_id: ORG,
    agent_id: "refund-agent-01",
    tool_name: "issue_refund",
    action_type: "financial.refund",
    action_payload: { amount: 100 },
    action_hash: "hash-abc",
    plain_english_summary: "Test summary",
    risk_level: "medium",
    risk_score: 50,
    risk_reasons: { matchedPolicies: [] },
    policy_decision: "review",
    status: "review_required",
    requested_by: null,
    idempotency_key: null,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    review_expires_at: new Date(Date.now() + 60_000).toISOString(),
    decided_at: new Date(Date.now() - 3_600_000).toISOString(),
    executed_at: null,
    ...overrides,
  };
}

function createDeps(initialRow: ActionProposalRow) {
  let row = { ...initialRow };
  const runtimeEvents: string[] = [];
  const decisions: unknown[] = [];

  const deps: HumanDecisionDeps = {
    ensureFresh: async () => row,
    finalizeDecision: async (_client, params) => {
      if (new Date(row.review_expires_at ?? row.expires_at) <= new Date(params.decidedAt)) {
        throw new ProposalError(
          "Proposal not found, already decided, review deadline expired, or action hash mismatch."
        );
      }
      row = { ...row, status: params.status, decided_at: params.decidedAt };
      return row;
    },
    insertDecision: async (_client, params) => {
      decisions.push(params);
    },
    recordRuntimeAudit: (_client, params) => {
      runtimeEvents.push(params.event);
    },
    recordRetrospectiveAudit: async () => {},
    listReviews: async () => [row],
    getProposal: async () => row,
  };

  return {
    deps,
    getRow: () => row,
    getRuntimeEvents: () => runtimeEvents,
    getDecisions: () => decisions,
    setRow: (next: ActionProposalRow) => {
      row = next;
    },
  };
}

describe("decideGatewayProposalReview", () => {
  it("approves before review expiry", async () => {
    const harness = createDeps(buildReviewRow());

    const result = await decideGatewayProposalReview(
      SUPABASE,
      SUPABASE,
      {
        proposalId: PROPOSAL_ID,
        organizationId: ORG,
        actorId: ACTOR_ID,
        actorEmail: "reviewer@example.com",
        decision: "approved",
      },
      harness.deps
    );

    assert.equal(result.status, "approved");
    assert.equal(harness.getRow().status, "approved");
    assert.ok(harness.getRuntimeEvents().includes("approval.approved"));
  });

  it("rejects before review expiry", async () => {
    const harness = createDeps(buildReviewRow());

    const result = await decideGatewayProposalReview(
      SUPABASE,
      SUPABASE,
      {
        proposalId: PROPOSAL_ID,
        organizationId: ORG,
        actorId: ACTOR_ID,
        actorEmail: "reviewer@example.com",
        decision: "rejected",
      },
      harness.deps
    );

    assert.equal(result.status, "rejected");
    assert.equal(harness.getRow().status, "rejected");
    assert.ok(harness.getRuntimeEvents().includes("approval.rejected"));
  });

  it("blocks human decision after review deadline", async () => {
    const harness = createDeps(
      buildReviewRow({
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
      })
    );

    harness.deps.ensureFresh = async () => ({
      ...harness.getRow(),
      status: "rejected",
    });

    await assert.rejects(
      () =>
        decideGatewayProposalReview(
          SUPABASE,
          SUPABASE,
          {
            proposalId: PROPOSAL_ID,
            organizationId: ORG,
            actorId: ACTOR_ID,
            actorEmail: "reviewer@example.com",
            decision: "approved",
          },
          harness.deps
        ),
      (err: ProposalError) => {
        assert.match(err.message, /automatically denied/i);
        return true;
      }
    );
  });

  it("loses race when finalize runs after timeout auto-deny", async () => {
    const harness = createDeps(
      buildReviewRow({
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
      })
    );

    harness.deps.finalizeDecision = async () => {
      throw new ProposalError(
        "Proposal not found, already decided, review deadline expired, or action hash mismatch."
      );
    };

    await assert.rejects(
      () =>
        decideGatewayProposalReview(
          SUPABASE,
          SUPABASE,
          {
            proposalId: PROPOSAL_ID,
            organizationId: ORG,
            actorId: ACTOR_ID,
            actorEmail: "reviewer@example.com",
            decision: "approved",
          },
          harness.deps
        ),
      (err: ProposalError) => {
        assert.match(err.message, /deadline/i);
        return true;
      }
    );
  });
});
