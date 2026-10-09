import assert from "node:assert/strict";
import test from "node:test";
import { validateDeliverySettings } from "./settings";

test("validateDeliverySettings requires phone for whatsapp mode", () => {
  const result = validateDeliverySettings({ mode: "whatsapp", destinationPhone: null });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.error, /WhatsApp recipient/);
  }
});

test("validateDeliverySettings accepts valid E.164 phone", () => {
  const result = validateDeliverySettings({
    mode: "whatsapp",
    destinationPhone: "+919876543210",
  });
  assert.equal(result.valid, true);
});
