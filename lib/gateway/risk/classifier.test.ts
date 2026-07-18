import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRisk,
  sanitizeShadowClassifierContext,
  SHADOW_CLASSIFIER_VERSION,
  ShadowRiskClassifierError,
  type ShadowRiskClassifierContext,
} from "./classifier";
import { buildRiskContext, extractDeterministicRiskSignals } from "./signals";

const baseContext: ShadowRiskClassifierContext = {
  agentId: "demo-refund-agent",
  toolName: "issue_refund",
  actionType: "financial.refund",
  payload: {
    customerId: "cus_123",
    amount: 50_000,
    currency: "INR",
  },
  policyDecision: "ALLOW",
  matchedPolicyNames: ["Small INR refund auto-allow"],
};

const validModelJson = {
  riskLevel: "low",
  score: 18,
  confidence: 0.88,
  reasons: ["Small refund within typical auto-allow range"],
  signals: [
    {
      code: "refund.amount.small",
      description: "Amount is below elevated review threshold",
      severity: "low",
    },
  ],
  recommendedDecision: "allow",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("sanitizeShadowClassifierContext", () => {
  it("redacts secret-like payload values before provider calls", () => {
    const sanitized = sanitizeShadowClassifierContext({
      ...baseContext,
      payload: {
        customerId: "cus_123",
        apiKey: "al_should_not_leak_to_model",
        executionToken: "et_should_not_leak_either",
      },
    });

    assert.equal(sanitized.payload.apiKey, "[redacted]");
    assert.equal(sanitized.payload.executionToken, "[redacted]");
    assert.equal(sanitized.payload.customerId, "cus_123");
  });

  it("uses deterministic risk context in prompt instead of raw payload", async () => {
    let prompt = "";
    const riskContext = buildRiskContext({
      agentId: baseContext.agentId,
      toolName: baseContext.toolName,
      actionType: baseContext.actionType,
      payload: baseContext.payload,
    });
    const deterministicSignals = extractDeterministicRiskSignals(riskContext);

    await classifyRisk(
      {
        ...baseContext,
        payload: {
          ...baseContext.payload,
          apiKey: "al_should_not_appear_in_prompt",
        },
        riskContext,
        deterministicSignals,
      },
      {
        completeJson: async (input) => {
          prompt = input;
          return JSON.stringify(validModelJson);
        },
        getModel: () => "test-model",
      }
    );

    assert.ok(prompt.includes("Risk context (deterministic)"));
    assert.ok(prompt.includes("Deterministic signals (authoritative facts)"));
    assert.ok(prompt.includes("financial.amount.present"));
    assert.equal(prompt.includes("al_should_not_appear_in_prompt"), false);
    assert.equal(prompt.includes("Payload:"), false);
  });
});

describe("classifyRisk", () => {
  it("returns a validated assessment for a valid provider response", async () => {
    const assessment = await classifyRisk(baseContext, {
      completeJson: async () => JSON.stringify(validModelJson),
      getModel: () => "test-model",
    });

    assert.equal(assessment.riskLevel, "low");
    assert.equal(assessment.recommendedDecision, "allow");
    assert.equal(assessment.modelProvider, "groq");
    assert.equal(assessment.modelName, "test-model");
    assert.equal(assessment.classifierVersion, SHADOW_CLASSIFIER_VERSION);
  });

  it("rejects malformed JSON from the provider", async () => {
    await assert.rejects(
      () =>
        classifyRisk(baseContext, {
          completeJson: async () => "not-json",
          getModel: () => "test-model",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskClassifierError);
        assert.equal(err.code, "malformed_json");
        return true;
      }
    );
  });

  it("rejects schema-invalid provider responses", async () => {
    await assert.rejects(
      () =>
        classifyRisk(baseContext, {
          completeJson: async () =>
            JSON.stringify({
              ...validModelJson,
              score: 150,
            }),
          getModel: () => "test-model",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskClassifierError);
        assert.equal(err.code, "validation_error");
        return true;
      }
    );
  });

  it("times out slow provider responses", async () => {
    await assert.rejects(
      () =>
        classifyRisk(baseContext, {
          completeJson: async () => {
            await sleep(100);
            return JSON.stringify(validModelJson);
          },
          getModel: () => "test-model",
          timeoutMs: 20,
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskClassifierError);
        assert.equal(err.code, "timeout");
        return true;
      }
    );
  });

  it("maps provider failures to provider_failure", async () => {
    await assert.rejects(
      () =>
        classifyRisk(baseContext, {
          completeJson: async () => {
            throw new Error("Groq API unavailable");
          },
          getModel: () => "test-model",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskClassifierError);
        assert.equal(err.code, "provider_failure");
        return true;
      }
    );
  });

  it('rejects attempted "block" recommendations from the provider', async () => {
    await assert.rejects(
      () =>
        classifyRisk(baseContext, {
          completeJson: async () =>
            JSON.stringify({
              ...validModelJson,
              recommendedDecision: "block",
            }),
          getModel: () => "test-model",
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShadowRiskClassifierError);
        assert.equal(err.code, "validation_error");
        return true;
      }
    );
  });
});
