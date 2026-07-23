import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePlanFromPayPalPlan } from "./env";
import {
  extractPayPalSubscriptionId,
  mapPayPalStatus,
} from "./sync";
import { parsePayPalWebhookHeaders } from "./verify-webhook";

describe("PayPal webhook helpers", () => {
  it("parses required PayPal signature headers", () => {
    const headers = new Headers({
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-123",
      "paypal-transmission-id": "tx-123",
      "paypal-transmission-sig": "sig-123",
      "paypal-transmission-time": "2026-07-01T10:00:00Z",
    });

    const parsed = parsePayPalWebhookHeaders(headers);
    assert.ok(parsed);
    assert.equal(parsed.authAlgo, "SHA256withRSA");
    assert.equal(parsed.transmissionId, "tx-123");
  });

  it("returns null when PayPal signature headers are incomplete", () => {
    const headers = new Headers({
      "paypal-transmission-id": "tx-123",
    });
    assert.equal(parsePayPalWebhookHeaders(headers), null);
  });

  it("extracts subscription id from webhook resource variants", () => {
    assert.equal(
      extractPayPalSubscriptionId({ id: "I-SUB-1" }),
      "I-SUB-1"
    );
    assert.equal(
      extractPayPalSubscriptionId({ billing_agreement_id: "I-SUB-2" }),
      "I-SUB-2"
    );
    assert.equal(
      extractPayPalSubscriptionId({ subscription_id: "I-SUB-3" }),
      "I-SUB-3"
    );
    assert.equal(extractPayPalSubscriptionId({}), null);
  });

  it("maps PayPal subscription statuses to internal statuses", () => {
    assert.equal(mapPayPalStatus("ACTIVE"), "active");
    assert.equal(mapPayPalStatus("SUSPENDED"), "paused");
    assert.equal(mapPayPalStatus("CANCELLED"), "canceled");
    assert.equal(mapPayPalStatus("EXPIRED"), "canceled");
    assert.equal(mapPayPalStatus("APPROVAL_PENDING"), "incomplete");
  });
});

describe("PayPal plan mapping", () => {
  it("returns null when plan env vars are unset", () => {
    assert.equal(resolvePlanFromPayPalPlan("P-UNKNOWN"), null);
  });

  it("maps configured PayPal plan IDs", () => {
    process.env.PAYPAL_PLAN_PROFESSIONAL_MONTHLY = "P-PRO-M";
    process.env.PAYPAL_PLAN_PROFESSIONAL_YEARLY = "P-PRO-Y";
    process.env.PAYPAL_PLAN_TEAM_MONTHLY = "P-TEAM-M";
    process.env.PAYPAL_PLAN_TEAM_YEARLY = "P-TEAM-Y";

    assert.deepEqual(resolvePlanFromPayPalPlan("P-PRO-M"), {
      planId: "professional",
      interval: "monthly",
    });
    assert.deepEqual(resolvePlanFromPayPalPlan("P-PRO-Y"), {
      planId: "professional",
      interval: "yearly",
    });
    assert.deepEqual(resolvePlanFromPayPalPlan("P-TEAM-M"), {
      planId: "team",
      interval: "monthly",
    });
    assert.deepEqual(resolvePlanFromPayPalPlan("P-TEAM-Y"), {
      planId: "team",
      interval: "yearly",
    });

    delete process.env.PAYPAL_PLAN_PROFESSIONAL_MONTHLY;
    delete process.env.PAYPAL_PLAN_PROFESSIONAL_YEARLY;
    delete process.env.PAYPAL_PLAN_TEAM_MONTHLY;
    delete process.env.PAYPAL_PLAN_TEAM_YEARLY;
  });
});
