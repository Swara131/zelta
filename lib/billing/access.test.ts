import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  canAccessFeature,
  canAccessMinimumPlan,
  effectiveAccessPlan,
  shouldEnforceUsageLimits,
} from "./access";
import { isDemoMode } from "./demo-mode";
import { isWithinLimit } from "./usage";

const ORIGINAL_DEMO_MODE = process.env.DEMO_MODE;

describe("demo mode", () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE;
  });

  afterEach(() => {
    if (ORIGINAL_DEMO_MODE === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = ORIGINAL_DEMO_MODE;
    }
  });

  it("is disabled by default", () => {
    assert.equal(isDemoMode(), false);
  });

  it("is enabled when DEMO_MODE=true", () => {
    process.env.DEMO_MODE = "true";
    assert.equal(isDemoMode(), true);
  });
});

describe("feature access helper", () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE;
  });

  afterEach(() => {
    if (ORIGINAL_DEMO_MODE === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = ORIGINAL_DEMO_MODE;
    }
  });

  it("uses stored plan when demo mode is off", () => {
    assert.equal(canAccessFeature("free", "translator"), false);
    assert.equal(canAccessFeature("professional", "translator"), true);
    assert.equal(effectiveAccessPlan("free"), "free");
  });

  it("grants enterprise access when demo mode is on", () => {
    process.env.DEMO_MODE = "true";
    assert.equal(effectiveAccessPlan("free"), "enterprise");
    assert.equal(canAccessFeature("free", "translator"), true);
    assert.equal(canAccessFeature("free", "integrations"), true);
    assert.equal(canAccessMinimumPlan("free", "enterprise"), true);
    assert.equal(shouldEnforceUsageLimits(), false);
    assert.equal(isWithinLimit("free", "apiCalls", 999_999, 1), true);
  });

  it("honors explicit demoMode flag on the client", () => {
    assert.equal(canAccessFeature("free", "translator", true), true);
    assert.equal(canAccessFeature("free", "translator", false), false);
    // Without an explicit flag, browser-side checks must stay false.
    assert.equal(canAccessFeature("free", "translator"), false);
  });
});
