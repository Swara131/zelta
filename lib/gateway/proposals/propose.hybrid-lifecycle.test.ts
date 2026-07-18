import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProposalError } from "@/lib/gateway/errors";
import { generateExecutionTokenMaterial } from "@/lib/gateway/tokens/crypto";
import {
  getProposalExecutionStatus,
  verifyProposalExecution,
} from "@/lib/gateway/tokens/service";
import { decideGatewayProposalReview } from "./human-decision";
import { proposeAction } from "./service";
import {
  ACTOR_ID,
  AUTH_CONTEXT,
  ORG_A,
  SUPABASE,
  actionHash,
  blockBody,
  buildShadowAssessment,
  createHumanDecisionDeps,
  createHumanDecisionDepsWithTimeout,
  createHybridProposeHarness,
  createTokenDeps,
  createTokenDepsWithReviewTimeout,
  hybridVerifyInput,
  proposeHybridEscalatedReview,
  validBody,
  withHybridEnv,
} from "./propose.hybrid.fixtures";

describe("hybrid lifecycle security (real token and approval services)", () => {
  it("REVIEW: repeated status polling before approval never issues a token", async () => {
    await withHybridEnv({}, async () => {
      const { proposeResult, tokenState } = await proposeHybridEscalatedReview();

      assert.equal(proposeResult.status, "review_required");
      const tokenDeps = createTokenDeps(tokenState);

      for (let poll = 0; poll < 3; poll += 1) {
        const status = await getProposalExecutionStatus(
          SUPABASE,
          AUTH_CONTEXT,
          tokenState.proposal.id,
          tokenDeps
        );

        assert.equal(status.status, "pending", `poll ${poll + 1}`);
        assert.equal(status.executionToken, undefined, `poll ${poll + 1}`);
        assert.equal(status.executionTokenIssued, undefined, `poll ${poll + 1}`);
      }

      assert.equal(tokenState.tokens.length, 0);

      const unissuedToken = generateExecutionTokenMaterial().plainToken;

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            {
              executionToken: unissuedToken,
              ...hybridVerifyInput,
            },
            tokenDeps
          ),
        (err: Error & { code?: string }) => {
          assert.equal(err.code, "not_eligible");
          return true;
        }
      );
    });
  });

  it("REVIEW: after approval, status poll issues exactly one token and verify succeeds once", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      await decideGatewayProposalReview(
        SUPABASE,
        SUPABASE,
        {
          proposalId: tokenState.proposal.id,
          organizationId: ORG_A,
          actorId: ACTOR_ID,
          actorEmail: "reviewer@example.com",
          decision: "approved",
        },
        humanDeps
      );

      assert.equal(tokenState.proposal.status, "approved");

      const firstPoll = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.equal(firstPoll.status, "approved");
      assert.ok(firstPoll.executionToken);
      assert.equal(tokenState.tokens.length, 1);

      const secondPoll = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.equal(secondPoll.status, "approved");
      assert.equal(secondPoll.executionToken, undefined);
      assert.equal(secondPoll.executionTokenIssued, true);
      assert.equal(tokenState.tokens.length, 1);

      const verifyResult = await verifyProposalExecution(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        {
          executionToken: firstPoll.executionToken!,
          ...hybridVerifyInput,
        },
        tokenDeps
      );

      assert.equal(verifyResult.allowed, true);
      assert.equal(verifyResult.actionHash, actionHash);
    });
  });

  it("REVIEW: rejected proposals remain non-executable", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      await decideGatewayProposalReview(
        SUPABASE,
        SUPABASE,
        {
          proposalId: tokenState.proposal.id,
          organizationId: ORG_A,
          actorId: ACTOR_ID,
          actorEmail: "reviewer@example.com",
          decision: "rejected",
        },
        humanDeps
      );

      assert.equal(tokenState.proposal.status, "rejected");

      const status = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.equal(status.status, "rejected");
      assert.equal(status.executionToken, undefined);
      assert.equal(tokenState.tokens.length, 0);

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            {
              executionToken: generateExecutionTokenMaterial().plainToken,
              ...hybridVerifyInput,
            },
            tokenDeps
          ),
        (err: Error & { code?: string }) => {
          assert.equal(err.code, "not_eligible");
          return true;
        }
      );
    });
  });

  it("BLOCK: status polling and verify never succeed", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "critical",
            confidence: 0.99,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(SUPABASE, AUTH_CONTEXT, blockBody, harness.deps);

      assert.equal(result.decision, "BLOCK");
      assert.equal(result.status, "blocked");

      const tokenState = { proposal: harness.getProposal(), tokens: [] };
      const tokenDeps = createTokenDeps(tokenState);

      for (let poll = 0; poll < 2; poll += 1) {
        const status = await getProposalExecutionStatus(
          SUPABASE,
          AUTH_CONTEXT,
          tokenState.proposal.id,
          tokenDeps
        );

        assert.equal(status.status, "blocked", `poll ${poll + 1}`);
        assert.equal(status.executionToken, undefined, `poll ${poll + 1}`);
      }

      assert.equal(tokenState.tokens.length, 0);

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            {
              executionToken: generateExecutionTokenMaterial().plainToken,
              ...hybridVerifyInput,
            },
            tokenDeps
          ),
        (err: Error & { code?: string }) => {
          assert.equal(err.code, "not_eligible");
          return true;
        }
      );
    });
  });

  it("replay: second verify with the same consumed token fails via real service checks", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      await decideGatewayProposalReview(
        SUPABASE,
        SUPABASE,
        {
          proposalId: tokenState.proposal.id,
          organizationId: ORG_A,
          actorId: ACTOR_ID,
          actorEmail: "reviewer@example.com",
          decision: "approved",
        },
        humanDeps
      );

      const issued = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      const verifyInput = {
        executionToken: issued.executionToken!,
        ...hybridVerifyInput,
      };

      const first = await verifyProposalExecution(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        verifyInput,
        tokenDeps
      );

      assert.equal(first.allowed, true);
      assert.equal(tokenState.proposal.status, "executed");
      assert.equal(tokenState.tokens[0]!.status, "used");

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            verifyInput,
            tokenDeps
          ),
        (err: Error & { code?: string }) => {
          assert.equal(err.code, "not_eligible");
          return true;
        }
      );
    });
  });

  it("replay: used token on an approved proposal is rejected with replayed", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      await decideGatewayProposalReview(
        SUPABASE,
        SUPABASE,
        {
          proposalId: tokenState.proposal.id,
          organizationId: ORG_A,
          actorId: ACTOR_ID,
          actorEmail: "reviewer@example.com",
          decision: "approved",
        },
        humanDeps
      );

      const issued = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.ok(issued.executionToken);
      tokenState.tokens[0]!.status = "used";
      tokenState.tokens[0]!.used_at = new Date().toISOString();
      tokenState.proposal = { ...tokenState.proposal, status: "approved", executed_at: null };

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            {
              executionToken: issued.executionToken!,
              ...hybridVerifyInput,
            },
            tokenDeps
          ),
        (err: Error & { code?: string }) => {
          assert.equal(err.code, "replayed");
          return true;
        }
      );
    });
  });

  it("replay: near-concurrent double verify cannot both succeed", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      await decideGatewayProposalReview(
        SUPABASE,
        SUPABASE,
        {
          proposalId: tokenState.proposal.id,
          organizationId: ORG_A,
          actorId: ACTOR_ID,
          actorEmail: "reviewer@example.com",
          decision: "approved",
        },
        humanDeps
      );

      const issued = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      const verifyInput = {
        executionToken: issued.executionToken!,
        ...hybridVerifyInput,
      };

      const outcomes = await Promise.allSettled([
        verifyProposalExecution(
          SUPABASE,
          AUTH_CONTEXT,
          tokenState.proposal.id,
          verifyInput,
          tokenDeps
        ),
        verifyProposalExecution(
          SUPABASE,
          AUTH_CONTEXT,
          tokenState.proposal.id,
          verifyInput,
          tokenDeps
        ),
      ]);

      const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");

      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);

      for (const failure of failures) {
        if (failure.status === "rejected") {
          const err = failure.reason as Error & { code?: string };
          assert.ok(
            err.code === "not_eligible" || err.code === "concurrent_use" || err.code === "replayed"
          );
        }
      }

      assert.equal(tokenState.proposal.status, "executed");
      assert.equal(tokenState.tokens[0]!.status, "used");
    });
  });

  it("timeout: expired hybrid REVIEW is auto-denied through real review timeout service", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();

      tokenState.proposal = {
        ...tokenState.proposal,
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
      };

      const tokenDeps = createTokenDepsWithReviewTimeout(tokenState);
      const status = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.equal(status.status, "rejected");
      assert.equal(tokenState.proposal.status, "rejected");
      assert.equal(status.executionToken, undefined);
      assert.equal(tokenState.tokens.length, 0);
    });
  });

  it("timeout: human approval after deadline uses real ensureReviewFreshOrProcessed and fails", async () => {
    await withHybridEnv({}, async () => {
      const { tokenState } = await proposeHybridEscalatedReview();

      tokenState.proposal = {
        ...tokenState.proposal,
        review_expires_at: new Date(Date.now() - 1_000).toISOString(),
      };

      const humanDeps = createHumanDecisionDepsWithTimeout(tokenState);

      await assert.rejects(
        () =>
          decideGatewayProposalReview(
            SUPABASE,
            SUPABASE,
            {
              proposalId: tokenState.proposal.id,
              organizationId: ORG_A,
              actorId: ACTOR_ID,
              actorEmail: "reviewer@example.com",
              decision: "approved",
            },
            humanDeps
          ),
        (err: ProposalError) => {
          assert.match(err.message, /automatically denied/i);
          return true;
        }
      );

      assert.equal(tokenState.proposal.status, "rejected");
    });
  });
});
