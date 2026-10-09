import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertValidIndianMobile,
  formatIndianPhoneDisplay,
  maskIndianPhone,
  normalizeIndianPhoneInput,
} from "./phone";

describe("whatsapp phone", () => {
  it("normalizes Indian mobile numbers to E.164", () => {
    assert.equal(normalizeIndianPhoneInput("9876543210"), "+919876543210");
    assert.equal(normalizeIndianPhoneInput("+91 98765 43210"), "+919876543210");
    assert.equal(normalizeIndianPhoneInput("919876543210"), "+919876543210");
  });

  it("formats and masks Indian numbers for display", () => {
    const e164 = "+919876543210";
    assert.equal(formatIndianPhoneDisplay(e164), "+91 98765 43210");
    assert.equal(maskIndianPhone(e164), "+91 98*** **210");
  });

  it("rejects invalid numbers", () => {
    assert.throws(() => assertValidIndianMobile("+911234567890"));
    assert.throws(() => normalizeIndianPhoneInput("12345"));
  });
});
