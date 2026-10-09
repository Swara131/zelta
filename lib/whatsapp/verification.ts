import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WHATSAPP_MAX_VERIFY_ATTEMPTS, WHATSAPP_VERIFICATION_TTL_MS } from "./env";
import { WhatsAppVerificationError } from "./errors";
import { assertValidIndianMobile } from "./phone";
import { sendWhatsAppText } from "./client";

function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateVerificationCode(): string {
  return String(randomInt(100000, 999999));
}

function codesMatch(storedHash: string, code: string): boolean {
  const incoming = Buffer.from(hashVerificationCode(code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  if (incoming.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(incoming, stored);
}

export async function sendWhatsAppVerificationCode(
  supabase: SupabaseClient,
  params: { userId: string; phoneE164: string }
): Promise<{ expiresAt: string; devCode?: string }> {
  const phoneE164 = assertValidIndianMobile(params.phoneE164);
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + WHATSAPP_VERIFICATION_TTL_MS).toISOString();

  const { error } = await supabase.from("whatsapp_verification_codes").insert({
    user_id: params.userId,
    phone_e164: phoneE164,
    code_hash: hashVerificationCode(code),
    expires_at: expiresAt,
  });

  if (error) {
    throw new WhatsAppVerificationError(error.message);
  }

  const message = [
    "Your Wave verification code is:",
    code,
    "",
    "This code expires in 10 minutes.",
    "Do not share it with anyone.",
  ].join("\n");

  let devCode: string | undefined;
  try {
    await sendWhatsAppText({ toE164: phoneE164, body: message });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "WhatsApp send failed.";
    throw new WhatsAppVerificationError(messageText);
  }

  if (process.env.NODE_ENV !== "production" && process.env.WHATSAPP_DEV_LOG === "true") {
    devCode = code;
  }

  return { expiresAt, devCode };
}

export async function verifyWhatsAppCode(
  supabase: SupabaseClient,
  params: { userId: string; phoneE164: string; code: string }
): Promise<{ phoneE164: string; verifiedAt: string }> {
  const phoneE164 = assertValidIndianMobile(params.phoneE164);
  const trimmedCode = params.code.trim();

  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new WhatsAppVerificationError("Enter the 6-digit code from WhatsApp.");
  }

  const { data: row, error } = await supabase
    .from("whatsapp_verification_codes")
    .select("id, code_hash, expires_at, attempts, verified_at")
    .eq("user_id", params.userId)
    .eq("phone_e164", phoneE164)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new WhatsAppVerificationError(error.message);
  }

  if (!row) {
    throw new WhatsAppVerificationError("No active verification code. Request a new one.");
  }

  if (row.attempts >= WHATSAPP_MAX_VERIFY_ATTEMPTS) {
    throw new WhatsAppVerificationError("Too many attempts. Request a new verification code.");
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new WhatsAppVerificationError("Verification code expired. Request a new one.");
  }

  const matched = codesMatch(row.code_hash, trimmedCode);

  await supabase
    .from("whatsapp_verification_codes")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id);

  if (!matched) {
    throw new WhatsAppVerificationError("Incorrect verification code.");
  }

  const verifiedAt = new Date().toISOString();

  await supabase
    .from("whatsapp_verification_codes")
    .update({ verified_at: verifiedAt })
    .eq("id", row.id);

  const { error: userError } = await supabase
    .from("users")
    .update({
      whatsapp_phone_e164: phoneE164,
      whatsapp_phone_verified_at: verifiedAt,
      approval_whatsapp_enabled: true,
    })
    .eq("id", params.userId);

  if (userError) {
    throw new WhatsAppVerificationError(userError.message);
  }

  return { phoneE164, verifiedAt };
}
