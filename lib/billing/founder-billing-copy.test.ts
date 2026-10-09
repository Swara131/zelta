import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countApprovalRequestsFromAudit,
  getPlanStatusDisplay,
  mapFounderUsage,
  SAAS_PLANS,
} from "./founder-billing-copy";

describe("founder-billing-copy", () => {
  it("defines four marketing SaaS plans including Pro", () => {
    assert.equal(SAAS_PLANS.length, 4);
    assert.equal(SAAS_PLANS[0]?.name, "FREE");
    assert.equal(SAAS_PLANS[3]?.name, "PRO");
  });

  it("maps founder usage with limits, helpers, and explanations", () => {
    const usage = mapFounderUsage("free", 0, 3, 0);
    assert.equal(usage.length, 3);
    assert.equal(usage[0]?.label, "Actions monitored");
    assert.equal(usage[0]?.used, 0);
    assert.match(usage[0]?.helperText ?? "", /1,000 actions remaining/);
    assert.match(usage[1]?.helperText ?? "", /Growth plan/);
    assert.equal(usage[2]?.helperText, "Low usage = low monthly cost");
    assert.ok(usage.every((item) => item.explanation.length > 0));
  });

  it("does not pretend paid billing without a Stripe customer", () => {
    const status = getPlanStatusDisplay("free", "monthly", null, false);
    assert.equal(status.status, "Free plan");
    assert.equal(status.nextBillingDate, "Not applicable");
    assert.equal(status.hasPaidSubscription, false);
  });

  it("counts approval-related audit events", () => {
    const count = countApprovalRequestsFromAudit([
      { runtimeEvent: "policy.review" },
      { runtimeEvent: "policy.allow" },
      { runtimeEvent: "approval.approved" },
    ]);
    assert.equal(count, 2);
  });
});
