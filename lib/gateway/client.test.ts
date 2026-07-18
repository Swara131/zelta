import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ApprovalLayerAgentClient,
  GatewayClientError,
} from "@/lib/gateway/client";
import type { ProposeActionResponse } from "@/lib/gateway/proposals/types";
import type { ProposalStatusResponse } from "@/lib/gateway/tokens/types";

const BASE_URL = "http://localhost:3000";
const API_KEY = "al_test1234_secretsegment";
const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createClient(fetchImpl: typeof fetch): ApprovalLayerAgentClient {
  return new ApprovalLayerAgentClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    pollIntervalMs: 10,
    pollTimeoutMs: 100,
    fetchImpl,
    sleep: async () => {},
  });
}

describe("ApprovalLayerAgentClient", () => {
  it("sends Bearer auth and propose payload to POST /api/v1/actions/propose", async () => {
    const proposeBody: ProposeActionResponse = {
      proposalId: PROPOSAL_ID,
      status: "allowed",
      actionHash: "hash-abc",
      decision: "ALLOW",
      matchedPolicies: [],
    };

    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const client = createClient((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse(proposeBody, 201);
    });

    const result = await client.propose({
      agentId: "demo-refund-agent",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR" },
    });

    assert.equal(result.proposalId, PROPOSAL_ID);
    assert.equal(result.decision, "ALLOW");
    assert.equal(capturedUrl, `${BASE_URL}/api/v1/actions/propose`);
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      (capturedInit?.headers as Record<string, string>).Authorization,
      `Bearer ${API_KEY}`
    );
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      agentId: "demo-refund-agent",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR" },
    });
  });

  it("getStatus calls GET /api/v1/actions/{id}/status", async () => {
    const statusBody: ProposalStatusResponse = {
      proposalId: PROPOSAL_ID,
      status: "approved",
      actionHash: "hash-abc",
      executionToken: "et_test_token",
    };

    let capturedUrl = "";
    const client = createClient((url) => {
      capturedUrl = url;
      return jsonResponse(statusBody);
    });

    const result = await client.getStatus(PROPOSAL_ID);
    assert.equal(result.executionToken, "et_test_token");
    assert.equal(
      capturedUrl,
      `${BASE_URL}/api/v1/actions/${encodeURIComponent(PROPOSAL_ID)}/status`
    );
  });

  it("pollUntilResolved returns when execution token is issued", async () => {
    let calls = 0;
    const client = createClient((url) => {
      if (!url.endsWith("/status")) {
        throw new Error(`Unexpected URL: ${url}`);
      }

      calls += 1;
      if (calls === 1) {
        return jsonResponse({
          proposalId: PROPOSAL_ID,
          status: "pending",
          actionHash: "hash-abc",
        });
      }

      return jsonResponse({
        proposalId: PROPOSAL_ID,
        status: "approved",
        actionHash: "hash-abc",
        executionToken: "et_fresh_token",
      });
    });

    const result = await client.pollUntilResolved(PROPOSAL_ID);
    assert.equal(result.executionToken, "et_fresh_token");
    assert.equal(calls, 2);
  });

  it("pollUntilResolved throws proposal_blocked for blocked status", async () => {
    const client = createClient(() =>
      jsonResponse({
        proposalId: PROPOSAL_ID,
        status: "blocked",
        actionHash: "hash-abc",
      })
    );

    await assert.rejects(
      () => client.pollUntilResolved(PROPOSAL_ID),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "proposal_blocked");
        return true;
      }
    );
  });

  it("pollUntilResolved throws poll_timeout when token never arrives", async () => {
    const client = new ApprovalLayerAgentClient({
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      pollIntervalMs: 5,
      pollTimeoutMs: 20,
      fetchImpl: () =>
        jsonResponse({
          proposalId: PROPOSAL_ID,
          status: "pending",
          actionHash: "hash-abc",
        }),
      sleep: async () => {},
    });

    await assert.rejects(
      () => client.pollUntilResolved(PROPOSAL_ID),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "poll_timeout");
        return true;
      }
    );
  });

  it("verifyExecution posts token and action binding fields", async () => {
    let capturedBody: unknown;
    const client = createClient((_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({
        allowed: true,
        proposalId: PROPOSAL_ID,
        actionHash: "hash-abc",
        consumedAt: "2026-07-08T12:00:00.000Z",
      });
    });

    const result = await client.verifyExecution(PROPOSAL_ID, {
      executionToken: "et_test_token",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR" },
    });

    assert.equal(result.allowed, true);
    assert.deepEqual(capturedBody, {
      executionToken: "et_test_token",
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: { amount: 50_000, currency: "INR" },
    });
  });

  it("maps API 401 errors to GatewayClientError unauthorized", async () => {
    const client = createClient(() =>
      jsonResponse({ error: "Invalid agent API key.", code: "invalid_token" }, 401)
    );

    await assert.rejects(
      () => client.getStatus(PROPOSAL_ID),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "unauthorized");
        assert.equal(err.status, 401);
        assert.equal(err.apiCode, "invalid_token");
        assert.equal(err.message, "Invalid agent API key.");
        return true;
      }
    );
  });

  it("maps API 403 verify errors to GatewayClientError forbidden", async () => {
    const client = createClient(() =>
      jsonResponse(
        { error: "Execution token has already been used.", code: "replayed" },
        403
      )
    );

    await assert.rejects(
      () =>
        client.verifyExecution(PROPOSAL_ID, {
          executionToken: "et_used",
          toolName: "issue_refund",
          actionType: "financial.refund",
          payload: {},
        }),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "forbidden");
        assert.equal(err.apiCode, "replayed");
        return true;
      }
    );
  });

  it("throws invalid_response for non-JSON error bodies", async () => {
    const client = createClient(
      () =>
        new Response("<html>404</html>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        })
    );

    await assert.rejects(
      () => client.getStatus(PROPOSAL_ID),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "invalid_response");
        return true;
      }
    );
  });

  it("strips trailing slashes from baseUrl", async () => {
    let capturedUrl = "";
    const client = new ApprovalLayerAgentClient({
      baseUrl: "http://localhost:3000///",
      apiKey: API_KEY,
      fetchImpl: (url) => {
        capturedUrl = url;
        return jsonResponse({
          proposalId: PROPOSAL_ID,
          status: "approved",
          actionHash: "hash",
        });
      },
    });

    await client.getStatus(PROPOSAL_ID);
    assert.equal(
      capturedUrl,
      `http://localhost:3000/api/v1/actions/${PROPOSAL_ID}/status`
    );
  });
});

describe("GatewayClientError helpers", () => {
  it("requires apiKey and baseUrl at construction", () => {
    assert.throws(
      () =>
        new ApprovalLayerAgentClient({
          baseUrl: BASE_URL,
          apiKey: "   ",
        }),
      (err: unknown) => {
        assert.ok(err instanceof GatewayClientError);
        assert.equal(err.code, "validation_error");
        return true;
      }
    );
  });
});
