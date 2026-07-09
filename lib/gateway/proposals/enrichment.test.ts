import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiProposalEnrichmentError } from "@/lib/groq/enrich-proposal";
import { parseProposalEnrichmentPayload } from "@/lib/groq/json";
import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import {
  assertPolicyDecisionUnchanged,
  buildStoredRiskReasons,
  resolveFinalDecision,
  safeEnrichProposalAction,
} from "./enrichment";

const validAiJson = {
  plainEnglishSummary: "The agent intends to issue a customer refund.",
  riskScore: 42,
  riskLevel: "medium",
  riskSignals: ["Financial transaction", "Customer funds movement"],
  riskReasons: ["Refund modifies customer balance", "Amount exceeds typical support tier"],
  reviewerAssistance: "Confirm refund amount and customer identity before approval.",
};

describe("parseProposalEnrichmentPayload", () => {
  it("accepts valid structured AI enrichment JSON", () => {
    const parsed = parseProposalEnrichmentPayload(validAiJson);
    assert.equal(parsed.plainEnglishSummary, validAiJson.plainEnglishSummary);
    assert.equal(parsed.riskScore, 42);
  });

  it("rejects malformed AI response", () => {
    assert.throws(
      () => parseProposalEnrichmentPayload({ plainEnglishSummary: "missing fields" }),
      (err: unknown) => err instanceof AiProposalEnrichmentError
    );
  });
});

describe("safeEnrichProposalAction", () => {
  it("returns successful AI enrichment", async () => {
    const outcome = await safeEnrichProposalAction(
      {
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 500_000, currency: "INR" },
        policyDecision: "ALLOW",
        matchedPolicies: [],
      },
      async () => ({
        ...validAiJson,
        riskLevel: "medium",
        model: "llama-3.3-70b-versatile",
      })
    );

    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.data.plainEnglishSummary, validAiJson.plainEnglishSummary);
      assert.equal(outcome.data.riskScore, 42);
    }
  });

  it("records Groq timeout/failure without throwing", async () => {
    const outcome = await safeEnrichProposalAction(
      {
        agentId: "refund-agent-01",
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: { amount: 500_000, currency: "INR" },
        policyDecision: "REVIEW",
        matchedPolicies: [],
      },
      async () => {
        throw new Error("Groq request timed out");
      }
    );

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.match(outcome.error, /timed out/i);
    }

    const stored = buildStoredRiskReasons([], outcome);
    assert.ok(stored.ai?.failure?.message);
    assert.ok(stored.ai?.failure?.recordedAt);
  });
});

describe("policy decision guardrails", () => {
  it("keeps explicit BLOCK when AI enrichment succeeds with low risk", async () => {
    const evaluation = evaluatePolicy({
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        environment: "production",
        resourceType: "database",
        destructiveOperation: true,
        productionTarget: true,
      },
    });

    assert.equal(evaluation.decision, "BLOCK");

    const enrichment = await safeEnrichProposalAction(
      {
        agentId: "db-agent",
        toolName: "delete_database",
        actionType: "database.delete",
        payload: {
          environment: "production",
          resourceType: "database",
          destructiveOperation: true,
          productionTarget: true,
        },
        policyDecision: evaluation.decision,
        matchedPolicies: evaluation.matchedPolicies,
      },
      async () => ({
        plainEnglishSummary: "Low risk delete",
        riskScore: 5,
        riskLevel: "low",
        riskSignals: [],
        riskReasons: ["AI incorrectly assessed as low risk"],
        reviewerAssistance: "Ignore AI — policy blocked this action.",
        model: "test-model",
      })
    );

    const finalDecision = resolveFinalDecision(evaluation.decision, enrichment);
    assert.equal(finalDecision, "BLOCK");
    assertPolicyDecisionUnchanged({
      policyDecision: evaluation.decision,
      finalDecision,
    });
  });

  it("does not silently ALLOW unknown actions when AI enrichment fails", () => {
    const evaluation = evaluatePolicy({
      toolName: "unknown_tool",
      actionType: "unknown.action",
      payload: { foo: "bar" },
    });

    assert.equal(evaluation.decision, "REVIEW");

    const stored = buildStoredRiskReasons(evaluation.matchedPolicies, {
      ok: false,
      error: "Groq unavailable",
    });

    const finalDecision = resolveFinalDecision(evaluation.decision, {
      ok: false,
      error: "Groq unavailable",
    });

    assert.equal(finalDecision, "REVIEW");
    assert.notEqual(finalDecision, "ALLOW");
    assert.ok(stored.ai?.failure);
  });
});
