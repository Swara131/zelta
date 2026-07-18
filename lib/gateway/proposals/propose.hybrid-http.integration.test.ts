import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleProposeActionRequest } from "@/app/api/v1/actions/propose/route";
import { AgentAuthError } from "@/lib/gateway/errors";
import { getProposalExecutionStatus } from "@/lib/gateway/tokens/service";
import type { ExecutionTokenRow } from "@/lib/gateway/tokens/types";
import { proposeAction } from "./service";
import {
  AUTH_CONTEXT,
  SUPABASE,
  blockBody,
  buildShadowAssessment,
  createHybridProposeHarness,
  createTokenDeps,
  readComposition,
  validBody,
  withHybridEnv,
} from "./propose.hybrid.fixtures";

const PROPOSE_URL = "http://localhost/api/v1/actions/propose";

type ProposeResponseBody = {
  proposalId: string;
  status: string;
  actionHash: string;
  decision: string;
  matchedPolicies?: unknown[];
};

function buildProposeRequest(body: unknown): Request {
  return new Request(PROPOSE_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer al_test_key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function postHybridPropose(params: {
  body: typeof validBody | typeof blockBody;
  harness: ReturnType<typeof createHybridProposeHarness>;
}): Promise<{
  response: Response;
  body: ProposeResponseBody;
  proposeInvoked: boolean;
}> {
  let proposeInvoked = false;

  const response = await handleProposeActionRequest(
    buildProposeRequest(params.body),
    {
      authenticate: async () => AUTH_CONTEXT,
      createAdmin: () => SUPABASE,
      propose: async (admin, auth, input, deps) => {
        proposeInvoked = true;
        return proposeAction(admin, auth, input, deps ?? params.harness.deps);
      },
    },
    undefined,
    params.harness.deps
  );

  const body = (await response.json()) as ProposeResponseBody & { code?: string };
  return { response, body, proposeInvoked };
}

describe("handleProposeActionRequest hybrid routing HTTP integration", () => {
  it("returns 201 REVIEW for hybrid-escalated ALLOW with high classifier risk", async () => {
    await withHybridEnv({}, async () => {
      let classifierCalls = 0;
      const harness = createHybridProposeHarness({
        onClassifierCall: () => {
          classifierCalls += 1;
        },
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "high",
            confidence: 0.85,
            recommendedDecision: "review",
          }),
      });

      const { response, body, proposeInvoked } = await postHybridPropose({
        body: validBody,
        harness,
      });

      assert.equal(response.status, 201);
      assert.equal(proposeInvoked, true);
      assert.equal(classifierCalls, 1);
      assert.equal(body.decision, "REVIEW");
      assert.equal(body.status, "review_required");
      assert.ok(body.proposalId);
      assert.ok(body.actionHash);

      assert.equal(harness.wasPersisted(), true);
      const row = harness.getProposal();
      const composition = readComposition(row);
      assert.equal(composition!.enforcementMode, "hybrid");
      assert.equal(composition!.finalDecision, "REVIEW");

      const tokenState = { proposal: row, tokens: [] as ExecutionTokenRow[] };
      const pendingStatus = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        row.id,
        createTokenDeps(tokenState)
      );

      assert.equal(pendingStatus.status, "pending");
      assert.equal(pendingStatus.executionToken, undefined);
      assert.equal(tokenState.tokens.length, 0);
    });
  });

  it("returns 201 ALLOW for medium classifier risk without issuing execution token at propose time", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "medium",
            confidence: 0.95,
            recommendedDecision: "review",
          }),
      });

      const { response, body, proposeInvoked } = await postHybridPropose({
        body: validBody,
        harness,
      });

      assert.equal(response.status, 201);
      assert.equal(proposeInvoked, true);
      assert.equal(body.decision, "ALLOW");
      assert.equal(body.status, "allowed");

      const row = harness.getProposal();
      assert.equal(readComposition(row)!.finalDecision, "ALLOW");

      const tokenState = { proposal: row, tokens: [] as ExecutionTokenRow[] };
      const status = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        row.id,
        createTokenDeps(tokenState)
      );

      assert.equal(status.status, "approved");
      assert.ok(status.executionToken);
      assert.equal(tokenState.tokens.length, 1);
    });
  });

  it("returns 201 BLOCK for deterministic block actions", async () => {
    await withHybridEnv({}, async () => {
      const harness = createHybridProposeHarness({
        classifyShadowRisk: async () =>
          buildShadowAssessment({
            riskLevel: "critical",
            confidence: 0.99,
            recommendedDecision: "review",
          }),
      });

      const { response, body, proposeInvoked } = await postHybridPropose({
        body: blockBody,
        harness,
      });

      assert.equal(response.status, 201);
      assert.equal(proposeInvoked, true);
      assert.equal(body.decision, "BLOCK");
      assert.equal(body.status, "blocked");

      const row = harness.getProposal();
      const tokenState = { proposal: row, tokens: [] as ExecutionTokenRow[] };
      const status = await getProposalExecutionStatus(
        SUPABASE,
        AUTH_CONTEXT,
        row.id,
        createTokenDeps(tokenState)
      );

      assert.equal(status.status, "blocked");
      assert.equal(status.executionToken, undefined);
      assert.equal(tokenState.tokens.length, 0);
    });
  });

  it("returns 401 for authentication failure without invoking propose", async () => {
    await withHybridEnv({}, async () => {
      let proposeInvoked = false;
      let classifierCalls = 0;

      const harness = createHybridProposeHarness({
        onClassifierCall: () => {
          classifierCalls += 1;
        },
      });

      const response = await handleProposeActionRequest(
        buildProposeRequest(validBody),
        {
          authenticate: async () => {
            throw new AgentAuthError("invalid_token", "Invalid agent API key.");
          },
          createAdmin: () => SUPABASE,
          propose: async () => {
            proposeInvoked = true;
            throw new Error("propose should not run");
          },
        },
        undefined,
        harness.deps
      );

      assert.equal(response.status, 401);
      const payload = (await response.json()) as { code?: string };
      assert.equal(payload.code, "invalid_token");
      assert.equal(proposeInvoked, false);
      assert.equal(classifierCalls, 0);
      assert.equal(harness.wasPersisted(), false);
    });
  });

  it("returns 400 for invalid payload without invoking classifier", async () => {
    await withHybridEnv({}, async () => {
      let proposeInvoked = false;
      let classifierCalls = 0;

      const harness = createHybridProposeHarness({
        onClassifierCall: () => {
          classifierCalls += 1;
        },
      });

      const response = await handleProposeActionRequest(
        buildProposeRequest({ agentId: "", toolName: "x", actionType: "y" }),
        {
          authenticate: async () => AUTH_CONTEXT,
          createAdmin: () => ({}) as SupabaseClient,
          propose: async () => {
            proposeInvoked = true;
            throw new Error("propose should not run");
          },
        },
        undefined,
        harness.deps
      );

      assert.equal(response.status, 400);
      assert.equal(proposeInvoked, false);
      assert.equal(classifierCalls, 0);
      assert.equal(harness.wasPersisted(), false);
    });
  });
});
