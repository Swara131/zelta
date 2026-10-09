import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  formatResendDeliveryError,
  getResendConfigStatus,
  parseFromEmailAddress,
} from "./resend-config";

describe("parseFromEmailAddress", () => {
  it("extracts address from display name format", () => {
    assert.equal(parseFromEmailAddress("Wave <hello@verified.com>"), "hello@verified.com");
  });
});

describe("getResendConfigStatus", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  });

  it("rejects placeholder yourdomain.com sender", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "Wave <notifications@yourdomain.com>";
    const status = getResendConfigStatus();
    assert.equal(status.configured, false);
    assert.match(status.error ?? "", /placeholder domain/i);
  });

  it("accepts verified-looking sender when api key present", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "Wave <onboarding@resend.dev>";
    const status = getResendConfigStatus();
    assert.equal(status.configured, true);
    assert.equal(status.error, null);
  });
});

describe("formatResendDeliveryError", () => {
  it("adds guidance for unverified domain errors", () => {
    const formatted = formatResendDeliveryError(
      "The yourdomain.com domain is not verified."
    );
    assert.match(formatted, /RESEND_FROM_EMAIL/i);
  });
});
