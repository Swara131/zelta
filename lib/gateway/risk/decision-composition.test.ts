import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHADOW_CLASSIFIER_PROVIDER, SHADOW_CLASSIFIER_VERSION } from "./classifier";
import { composeGatewayDecision, toStoredDecisionComposition } from "./decision-composition";
import type { ExplainableRiskAssessment } from "./assessment";

const ACTION_HASH = "abc123hash";

function buildAssessment(
  overrides: Partial<ExplainableRiskAssessment> = {}
): ExplainableRiskAssessment {
  return {
    riskLevel: "low",
    score: 20,
    confidence: 0.9,
    reasons: ["Routine action"],
    signalCodes: ["agent.identity"],
    signals: [
      {
        code: "agent.identity",
        description: "Agent identity",
        severity: "low",
        source: "deterministic",
      },
    ],
    deterministicSignalCodes: ["agent.identity"],
    contextualSignals: [],
    recommendedDecision: "allow",
    modelProvider: SHADOW_CLASSIFIER_PROVIDER,
    modelName: "test-model",
    classifierVersion: SHADOW_CLASSIFIER_VERSION,
    classifierStatus: "completed",
    latencyMs: 50,
    ...overrides,
  };
}

describe("composeGatewayDecision precedence", () => {
  it("1. deterministic BLOCK always remains BLOCK", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "BLOCK",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "low", recommendedDecision: "allow" }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "BLOCK");
    assert.equal(result.escalated, false);
  });

  it("2. deterministic REVIEW always remains REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "REVIEW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "low", recommendedDecision: "allow" }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, false);
  });

  it("3-4. enforce + ALLOW + critical/high escalates to REVIEW", () => {
    for (const riskLevel of ["critical", "high"] as const) {
      const result = composeGatewayDecision({
        deterministicDecision: "ALLOW",
        riskAssessment: {
          status: "completed",
          assessment: buildAssessment({ riskLevel, recommendedDecision: "allow" }),
        },
        actionHash: ACTION_HASH,
        enforcementMode: "enforce",
      });

      assert.equal(result.finalDecision, "REVIEW", `riskLevel=${riskLevel}`);
      assert.equal(result.escalated, true);
    }
  });

  it("5. enforce + ALLOW + low risk preserves ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "low",
          score: 15,
          confidence: 0.9,
          recommendedDecision: "allow",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("6. enforce + ALLOW + medium risk escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "medium",
          recommendedDecision: "allow",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("7. enforce + ALLOW + low confidence escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "low",
          confidence: 0.2,
          recommendedDecision: "allow",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalationReason, "Low classifier confidence requires review.");
  });

  it("8. enforce + classifier failed + preserve fail-safe keeps ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "failed", failureCode: "timeout" },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
      failsafeMode: "preserve",
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("8b. enforce + classifier failed + review fail-safe escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "failed", failureCode: "timeout" },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
      failsafeMode: "review",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("shadow mode never escalates ALLOW even with critical risk", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "critical",
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "shadow",
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
    assert.equal(result.riskRecommendedDecision, "review");
  });
});

describe("composeGatewayDecision security invariants", () => {
  const matrix: Array<{
    name: string;
    deterministic: "ALLOW" | "REVIEW" | "BLOCK";
    enforcementMode: "shadow" | "enforce";
    assessment: ExplainableRiskAssessment;
    expectedFinal: "ALLOW" | "REVIEW" | "BLOCK";
  }> = [
    {
      name: "BLOCK + enforce + critical",
      deterministic: "BLOCK",
      enforcementMode: "enforce",
      assessment: buildAssessment({ riskLevel: "critical", recommendedDecision: "review" }),
      expectedFinal: "BLOCK",
    },
    {
      name: "REVIEW + enforce + low allow",
      deterministic: "REVIEW",
      enforcementMode: "enforce",
      assessment: buildAssessment({ riskLevel: "low", recommendedDecision: "allow" }),
      expectedFinal: "REVIEW",
    },
    {
      name: "ALLOW + shadow + high",
      deterministic: "ALLOW",
      enforcementMode: "shadow",
      assessment: buildAssessment({ riskLevel: "high", recommendedDecision: "review" }),
      expectedFinal: "ALLOW",
    },
    {
      name: "ALLOW + enforce + high",
      deterministic: "ALLOW",
      enforcementMode: "enforce",
      assessment: buildAssessment({ riskLevel: "high", recommendedDecision: "review" }),
      expectedFinal: "REVIEW",
    },
  ];

  for (const caseDef of matrix) {
    it(`never violates precedence: ${caseDef.name}`, () => {
      const result = composeGatewayDecision({
        deterministicDecision: caseDef.deterministic,
        riskAssessment: { status: "completed", assessment: caseDef.assessment },
        actionHash: ACTION_HASH,
        enforcementMode: caseDef.enforcementMode,
      });

      assert.equal(result.finalDecision, caseDef.expectedFinal);
      if (caseDef.deterministic !== "BLOCK") {
        assert.notEqual(result.finalDecision, "BLOCK", "AI must never BLOCK");
      }
      if (caseDef.deterministic === "REVIEW") {
        assert.notEqual(result.finalDecision, "ALLOW", "REVIEW must not downgrade to ALLOW");
      }
      if (caseDef.deterministic === "BLOCK") {
        assert.equal(result.finalDecision, "BLOCK", "BLOCK must never change");
      }
    });
  }

  it("never produces BLOCK as final decision from risk path", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "critical", recommendedDecision: "review" }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.notEqual(result.finalDecision, "BLOCK");
  });
});

describe("composeGatewayDecision exhaustive decision matrix", () => {
  const deterministicDecisions = ["ALLOW", "REVIEW", "BLOCK"] as const;
  const enforcementModes = ["shadow", "enforce"] as const;
  const riskLevels = ["low", "medium", "high", "critical"] as const;
  const failsafeModes = ["preserve", "review"] as const;

  for (const deterministic of deterministicDecisions) {
    for (const enforcementMode of enforcementModes) {
      for (const riskLevel of riskLevels) {
        it(`matrix: ${deterministic} + ${enforcementMode} + completed ${riskLevel}`, () => {
          const result = composeGatewayDecision({
            deterministicDecision: deterministic,
            riskAssessment: {
              status: "completed",
              assessment: buildAssessment({
                riskLevel,
                confidence: 0.9,
                recommendedDecision: riskLevel === "low" ? "allow" : "review",
              }),
            },
            actionHash: ACTION_HASH,
            enforcementMode,
          });

          if (deterministic === "BLOCK") {
            assert.equal(result.finalDecision, "BLOCK");
            assert.equal(result.escalated, false);
            return;
          }
          if (deterministic === "REVIEW") {
            assert.equal(result.finalDecision, "REVIEW");
            assert.equal(result.escalated, false);
            return;
          }

          if (enforcementMode === "shadow") {
            assert.equal(result.finalDecision, "ALLOW");
            assert.equal(result.escalated, false);
            return;
          }

          if (riskLevel === "low") {
            assert.equal(result.finalDecision, "ALLOW");
            assert.equal(result.escalated, false);
          } else {
            assert.equal(result.finalDecision, "REVIEW");
            assert.equal(result.escalated, true);
          }
        });
      }

      for (const failsafeMode of failsafeModes) {
        it(`matrix: ${deterministic} + ${enforcementMode} + classifier failed + ${failsafeMode}`, () => {
          const result = composeGatewayDecision({
            deterministicDecision: deterministic,
            riskAssessment: { status: "failed", failureCode: "timeout" },
            actionHash: ACTION_HASH,
            enforcementMode,
            failsafeMode,
          });

          if (deterministic === "BLOCK") {
            assert.equal(result.finalDecision, "BLOCK");
            return;
          }
          if (deterministic === "REVIEW") {
            assert.equal(result.finalDecision, "REVIEW");
            return;
          }

          if (enforcementMode === "shadow") {
            assert.equal(result.finalDecision, "ALLOW");
            return;
          }

          if (failsafeMode === "review") {
            assert.equal(result.finalDecision, "REVIEW");
            assert.equal(result.escalated, true);
          } else {
            assert.equal(result.finalDecision, "ALLOW");
            assert.equal(result.escalated, false);
          }
        });
      }
    }
  }

  it("matrix: ALLOW + enforce + low risk + low confidence escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "low",
          confidence: 0.1,
          recommendedDecision: "allow",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("toStoredDecisionComposition preserves audit fields", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "high" }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    const stored = toStoredDecisionComposition(result, ACTION_HASH, "2026-07-01T00:00:00.000Z");

    assert.equal(stored.deterministicDecision, "ALLOW");
    assert.equal(stored.finalDecision, "REVIEW");
    assert.equal(stored.actionHash, ACTION_HASH);
    assert.equal(stored.classifierVersion, SHADOW_CLASSIFIER_VERSION);
    assert.equal(stored.composedAt, "2026-07-01T00:00:00.000Z");
    assert.ok(stored.escalationReason);
  });
});

describe("composeGatewayDecision hybrid mode", () => {
  const HYBRID_THRESHOLD = 0.7;

  it("BLOCK stays BLOCK", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "BLOCK",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "critical", confidence: 0.99 }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "BLOCK");
    assert.equal(result.escalated, false);
  });

  it("REVIEW stays REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "REVIEW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({ riskLevel: "low", recommendedDecision: "allow" }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, false);
  });

  it("ALLOW + high + confidence above threshold escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "high",
          confidence: 0.85,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("ALLOW + critical + confidence equal threshold escalates to REVIEW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "critical",
          confidence: HYBRID_THRESHOLD,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("ALLOW + medium + high confidence preserves ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "medium",
          confidence: 0.95,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("ALLOW + high + confidence below threshold preserves ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "high",
          confidence: 0.65,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("timeout preserves deterministic ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "failed", failureCode: "timeout" },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      failsafeMode: "review",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("classifier failure preserves deterministic ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "failed", failureCode: "provider_failure" },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      failsafeMode: "review",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("missing assessment preserves deterministic ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "completed" },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("pending assessment preserves deterministic ALLOW", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: { status: "pending" },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("shadow mode unchanged with critical risk", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "critical",
          confidence: 0.99,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "shadow",
    });

    assert.equal(result.finalDecision, "ALLOW");
    assert.equal(result.escalated, false);
  });

  it("enforce mode unchanged for medium risk escalation", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "medium",
          confidence: 0.95,
          recommendedDecision: "allow",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "enforce",
    });

    assert.equal(result.finalDecision, "REVIEW");
    assert.equal(result.escalated, true);
  });

  it("hybrid never produces BLOCK", () => {
    const result = composeGatewayDecision({
      deterministicDecision: "ALLOW",
      riskAssessment: {
        status: "completed",
        assessment: buildAssessment({
          riskLevel: "critical",
          confidence: 0.99,
          recommendedDecision: "review",
        }),
      },
      actionHash: ACTION_HASH,
      enforcementMode: "hybrid",
      hybridConfidenceThreshold: HYBRID_THRESHOLD,
    });

    assert.notEqual(result.finalDecision, "BLOCK");
  });
});
