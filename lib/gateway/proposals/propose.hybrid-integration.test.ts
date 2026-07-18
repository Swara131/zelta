import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShadowRiskClassifierError } from "@/lib/gateway/risk/classifier";
import {
  getProposalExecutionStatus,
  verifyProposalExecution,
} from "@/lib/gateway/tokens/service";
import type { ExecutionTokenRow } from "@/lib/gateway/tokens/types";
import { decideGatewayProposalReview } from "./human-decision";
import { proposeAction } from "./service";
import {
  ACTOR_ID,
  AUTH_CONTEXT,
  HYBRID_THRESHOLD,
  ORG_A,
  SUPABASE,
  actionHash,
  blockBody,
  buildShadowAssessment,
  createHumanDecisionDeps,
  createHybridProposeHarness,
  createTokenDeps,
  readComposition,
  validBody,
  withHybridEnv,
} from "./propose.hybrid.fixtures";

describe("proposeAction hybrid routing integration", () => {
  it("escalates deterministic ALLOW to REVIEW for high risk above threshold", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "high",
            confidence: 0.85,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "REVIEW");
      assert.equal(result.status, "review_required");

      const row = harness.getProposal();
      const composition = readComposition(row);
      assert.ok(composition);
      assert.equal(composition!.deterministicDecision, "ALLOW");
      assert.equal(composition!.finalDecision, "REVIEW");
      assert.equal(composition!.escalated, true);
      assert.equal(composition!.enforcementMode, "hybrid");
      assert.equal(composition!.actionHash, result.actionHash);
      assert.ok(row.review_expires_at);
    });
  });

  it("escalates deterministic ALLOW to REVIEW for critical risk at threshold", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "critical",
            confidence: HYBRID_THRESHOLD,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "REVIEW");
      assert.equal(result.status, "review_required");

      const composition = readComposition(harness.getProposal());
      assert.equal(composition!.finalDecision, "REVIEW");
      assert.equal(composition!.enforcementMode, "hybrid");
    });
  });

  it("preserves deterministic ALLOW for medium risk with high confidence", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "medium",
            confidence: 0.95,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "ALLOW");
      assert.equal(result.status, "allowed");

      const composition = readComposition(harness.getProposal());
      assert.equal(composition!.finalDecision, "ALLOW");
      assert.equal(composition!.escalated, false);
      assert.equal(composition!.enforcementMode, "hybrid");
    });
  });

  it("preserves deterministic BLOCK for high/critical classifier output", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "critical",
            confidence: 0.99,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        blockBody,
        harness.deps
      );

      assert.equal(result.decision, "BLOCK");
      assert.equal(result.status, "blocked");

      const composition = readComposition(harness.getProposal());
      assert.equal(composition!.finalDecision, "BLOCK");
      assert.equal(composition!.escalated, false);
    });
  });

  it("preserves deterministic REVIEW regardless of classifier output", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "low",
            confidence: 0.99,
            recommendedDecision: "allow",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        {
          ...validBody,
          payload: { customerId: "cus_123", amount: 600_000, currency: "INR" },
        },
        harness.deps
      );

      assert.equal(result.decision, "REVIEW");
      assert.equal(result.status, "review_required");

      const composition = readComposition(harness.getProposal());
      assert.equal(composition!.deterministicDecision, "REVIEW");
      assert.equal(composition!.finalDecision, "REVIEW");
      assert.equal(composition!.escalated, false);
    });
  });

  it("preserves deterministic ALLOW when classifier times out", async () => {
    await withHybridEnv({ failsafe: "review" }, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () => {
          throw new ShadowRiskClassifierError("timeout", "Shadow classifier timed out.");
        },
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "ALLOW");
      assert.equal(result.status, "allowed");

      const composition = readComposition(harness.getProposal());
      assert.equal(composition!.finalDecision, "ALLOW");
      assert.equal(composition!.escalated, false);
    });
  });

  it("preserves deterministic ALLOW when classifier fails", async () => {
    await withHybridEnv({ failsafe: "review" }, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () => {
          throw new ShadowRiskClassifierError("provider_failure", "Groq unavailable.");
        },
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "ALLOW");
      assert.equal(result.status, "allowed");
    });
  });

  it("preserves deterministic ALLOW for high risk below confidence threshold", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "high",
            confidence: 0.65,
            recommendedDecision: "review",
          }),
      });

      const result = await proposeAction(
        SUPABASE,
        AUTH_CONTEXT,
        validBody,
        harness.deps
      );

      assert.equal(result.decision, "ALLOW");
      assert.equal(result.status, "allowed");
    });
  });

  it("hybrid-escalated proposal stays pending without token until human approval", async () => {
    await withHybridEnv({}, async () => {
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

      assert.equal(proposeResult.status, "review_required");

      const proposal = harness.getProposal();
      const tokenState = { proposal, tokens: [] as ExecutionTokenRow[] };
      const tokenDeps = createTokenDeps(tokenState);

      const pendingStatus = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        proposal.id,
        tokenDeps
      );

      assert.equal(pendingStatus.status, "pending");
      assert.equal(pendingStatus.actionHash, proposeResult.actionHash);
      assert.equal(pendingStatus.executionToken, undefined);
      assert.equal(tokenState.tokens.length, 0);
    });
  });

  it("issues and verifies execution token after human approval of hybrid-escalated proposal", async () => {
    await withHybridEnv({}, async () => {
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

      assert.equal(proposeResult.status, "review_required");
      assert.equal(proposeResult.actionHash, actionHash);

      const tokenState = {
        proposal: harness.getProposal(),
        tokens: [] as ExecutionTokenRow[],
      };
      const tokenDeps = createTokenDeps(tokenState);
      const humanDeps = createHumanDecisionDeps(tokenState);

      const approval = await decideGatewayProposalReview(
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

      assert.equal(approval.status, "approved");
      assert.equal(approval.actionHash, actionHash);
      assert.equal(tokenState.proposal.status, "approved");

      const approvedStatus = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        tokenDeps
      );

      assert.equal(approvedStatus.status, "approved");
      assert.equal(approvedStatus.actionHash, actionHash);
      assert.ok(approvedStatus.executionToken);
      assert.ok(approvedStatus.executionTokenExpiresAt);
      assert.equal(tokenState.tokens.length, 1);

      const verifyResult = await verifyProposalExecution(
        SUPABASE,
        AUTH_CONTEXT,
        tokenState.proposal.id,
        {
          executionToken: approvedStatus.executionToken!,
          toolName: validBody.toolName,
          actionType: validBody.actionType,
          payload: validBody.payload,
        },
        tokenDeps
      );

      assert.equal(verifyResult.allowed, true);
      assert.equal(verifyResult.actionHash, actionHash);
      assert.equal(tokenState.proposal.status, "executed");
      assert.ok(tokenState.proposal.executed_at);
      assert.equal(tokenState.tokens[0]!.status, "used");

      await assert.rejects(
        () =>
          verifyProposalExecution(
            SUPABASE,
            AUTH_CONTEXT,
            tokenState.proposal.id,
            {
              executionToken: approvedStatus.executionToken!,
              toolName: validBody.toolName,
              actionType: validBody.actionType,
              payload: validBody.payload,
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
});
