import { WhatsAppPhoneError } from "./errors";

const INDIA_E164 = /^\+91[6-9]\d{9}$/;

/** Strips spaces/dashes and normalizes Indian numbers to +91XXXXXXXXXX. */
export function normalizeIndianPhoneInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new WhatsAppPhoneError("Enter your WhatsApp number.");
  }

  const digitsOnly = trimmed.replace(/[^\d+]/g, "");

  if (digitsOnly.startsWith("+91")) {
    return `+91${digitsOnly.slice(3).replace(/\D/g, "").slice(0, 10)}`;
  }

  if (digitsOnly.startsWith("91") && digitsOnly.length >= 12) {
    return `+91${digitsOnly.slice(2, 12)}`;
  }

  if (/^[6-9]\d{9}$/.test(digitsOnly.replace(/\D/g, ""))) {
    return `+91${digitsOnly.replace(/\D/g, "").slice(0, 10)}`;
  }

  if (digitsOnly.startsWith("+")) {
    return digitsOnly;
  }

  throw new WhatsAppPhoneError("Enter a valid Indian mobile number (+91 XXXXX XXXXX).");
}

export function assertValidIndianMobile(e164: string): string {
  if (!INDIA_E164.test(e164)) {
    throw new WhatsAppPhoneError("Enter a valid Indian mobile number (+91 XXXXX XXXXX).");
  }
  return e164;
}

/** Formats +919876543210 as +91 98765 43210 */
export function formatIndianPhoneDisplay(e164: string): string {
  const normalized = assertValidIndianMobile(e164);
  const local = normalized.slice(3);
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function maskIndianPhone(e164: string): string {
  if (!INDIA_E164.test(e164)) {
    return e164;
  }
  const local = e164.slice(3);
  return `+91 ${local.slice(0, 2)}*** **${local.slice(7)}`;
}

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Normalize international E.164 numbers for WhatsApp (e.g. +919876543210). */
export function normalizeWhatsAppRecipient(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new WhatsAppPhoneError("Enter a WhatsApp recipient number.");
  }

  if (INDIA_E164.test(trimmed.replace(/\s/g, ""))) {
    return assertValidIndianMobile(trimmed.replace(/\s/g, ""));
  }

  try {
    const indian = normalizeIndianPhoneInput(trimmed);
    if (INDIA_E164.test(indian)) return indian;
  } catch {
    // fall through to generic E.164
  }

  const compact = trimmed.replace(/[^\d+]/g, "");
  const normalized = compact.startsWith("+") ? compact : `+${compact.replace(/^\+/, "")}`;

  if (!E164_PATTERN.test(normalized)) {
    throw new WhatsAppPhoneError(
      "Enter a valid phone number in international format (e.g. +919876543210)."
    );
  }

  return normalized;
}

export function maskPhoneDisplay(e164: string): string {
  if (INDIA_E164.test(e164)) {
    return maskIndianPhone(e164);
  }
  if (e164.length > 6) {
    return `${e164.slice(0, 3)}••••••${e164.slice(-4)}`;
  }
  return e164;
}
