import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRiskEnforcementMode,
  parseRiskFailsafeMode,
  parseRiskHybridConfidenceThreshold,
  getRiskEnforcementMode,
  getRiskFailsafeMode,
  getRiskHybridConfidenceThreshold,
  DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD,
} from "./config";

describe("risk config", () => {
  it("parseRiskEnforcementMode defaults to shadow", () => {
    assert.equal(parseRiskEnforcementMode(undefined), "shadow");
    assert.equal(parseRiskEnforcementMode(""), "shadow");
    assert.equal(parseRiskEnforcementMode("invalid"), "shadow");
    assert.equal(parseRiskEnforcementMode("SHADOW"), "shadow");
    assert.equal(parseRiskEnforcementMode("enforce"), "enforce");
    assert.equal(parseRiskEnforcementMode(" ENFORCE "), "enforce");
    assert.equal(parseRiskEnforcementMode("hybrid"), "hybrid");
    assert.equal(parseRiskEnforcementMode(" HYBRID "), "hybrid");
  });

  it("parseRiskFailsafeMode defaults to preserve", () => {
    assert.equal(parseRiskFailsafeMode(undefined), "preserve");
    assert.equal(parseRiskFailsafeMode("invalid"), "preserve");
    assert.equal(parseRiskFailsafeMode("review"), "review");
    assert.equal(parseRiskFailsafeMode("PRESERVE"), "preserve");
  });

  it("getRiskEnforcementMode reads env with shadow default", () => {
    const original = process.env.RISK_ENFORCEMENT_MODE;
    try {
      delete process.env.RISK_ENFORCEMENT_MODE;
      assert.equal(getRiskEnforcementMode(), "shadow");

      process.env.RISK_ENFORCEMENT_MODE = "enforce";
      assert.equal(getRiskEnforcementMode(), "enforce");

      process.env.RISK_ENFORCEMENT_MODE = "hybrid";
      assert.equal(getRiskEnforcementMode(), "hybrid");
    } finally {
      if (original === undefined) {
        delete process.env.RISK_ENFORCEMENT_MODE;
      } else {
        process.env.RISK_ENFORCEMENT_MODE = original;
      }
    }
  });

  it("getRiskFailsafeMode reads env with preserve default", () => {
    const original = process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
    try {
      delete process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
      assert.equal(getRiskFailsafeMode(), "preserve");

      process.env.RISK_FAILSAFE_ON_UNAVAILABLE = "review";
      assert.equal(getRiskFailsafeMode(), "review");
    } finally {
      if (original === undefined) {
        delete process.env.RISK_FAILSAFE_ON_UNAVAILABLE;
      } else {
        process.env.RISK_FAILSAFE_ON_UNAVAILABLE = original;
      }
    }
  });

  it("parseRiskHybridConfidenceThreshold defaults to 0.7", () => {
    assert.equal(parseRiskHybridConfidenceThreshold(undefined), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);
    assert.equal(parseRiskHybridConfidenceThreshold(""), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);
    assert.equal(parseRiskHybridConfidenceThreshold("invalid"), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);
    assert.equal(parseRiskHybridConfidenceThreshold("-0.1"), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);
    assert.equal(parseRiskHybridConfidenceThreshold("1.1"), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);
    assert.equal(parseRiskHybridConfidenceThreshold("0.85"), 0.85);
    assert.equal(parseRiskHybridConfidenceThreshold(" 0 "), 0);
    assert.equal(parseRiskHybridConfidenceThreshold("1"), 1);
  });

  it("getRiskHybridConfidenceThreshold reads env with 0.7 default", () => {
    const original = process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD;
    try {
      delete process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD;
      assert.equal(getRiskHybridConfidenceThreshold(), DEFAULT_RISK_HYBRID_CONFIDENCE_THRESHOLD);

      process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD = "0.8";
      assert.equal(getRiskHybridConfidenceThreshold(), 0.8);
    } finally {
      if (original === undefined) {
        delete process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD;
      } else {
        process.env.RISK_HYBRID_CONFIDENCE_THRESHOLD = original;
      }
    }
  });
});
