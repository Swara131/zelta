function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(
    optionalEnv("TWILIO_ACCOUNT_SID") &&
      optionalEnv("TWILIO_AUTH_TOKEN") &&
      optionalEnv("TWILIO_WHATSAPP_FROM")
  );
}

export function getTwilioAccountSid(): string {
  const value = optionalEnv("TWILIO_ACCOUNT_SID");
  if (!value) {
    throw new Error(
      "Missing TWILIO_ACCOUNT_SID. Add Twilio credentials to .env.local (see .env.example)."
    );
  }
  return value;
}

export function getTwilioAuthToken(): string {
  const value = optionalEnv("TWILIO_AUTH_TOKEN");
  if (!value) {
    throw new Error(
      "Missing TWILIO_AUTH_TOKEN. Add Twilio credentials to .env.local (see .env.example)."
    );
  }
  return value;
}

export function getTwilioWhatsAppFrom(): string {
  const value = optionalEnv("TWILIO_WHATSAPP_FROM");
  if (!value) {
    throw new Error(
      "Missing TWILIO_WHATSAPP_FROM. Use your Twilio WhatsApp sender (e.g. whatsapp:+14155238886)."
    );
  }
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

/** Twilio Content Template SID (HX…) — required for business-initiated WhatsApp on own numbers. */
export function getTwilioWhatsAppContentSid(): string | undefined {
  return optionalEnv("TWILIO_WHATSAPP_CONTENT_SID");
}

/** Optional Messaging Service SID (MG…) — often required with Content Templates. */
export function getTwilioMessagingServiceSid(): string | undefined {
  return optionalEnv("TWILIO_MESSAGING_SERVICE_SID");
}

/** `body` = full message in {{1}}; `ticket` = {{1}} customer, {{2}} ticket, {{3}} resolution, {{4}} rating. */
export function getWhatsAppContentMode(): "body" | "ticket" {
  const mode = optionalEnv("TWILIO_WHATSAPP_CONTENT_MODE")?.toLowerCase();
  return mode === "ticket" ? "ticket" : "body";
}

const TWILIO_SANDBOX_FROM = "+14155238886";

export function getTwilioWhatsAppSandboxFrom(): string {
  const value = optionalEnv("TWILIO_WHATSAPP_SANDBOX_FROM") ?? `whatsapp:${TWILIO_SANDBOX_FROM}`;
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export function isTwilioWhatsAppSandboxSender(from?: string): boolean {
  const value = (from ?? optionalEnv("TWILIO_WHATSAPP_FROM") ?? "").replace(/^whatsapp:/i, "");
  return value === TWILIO_SANDBOX_FROM;
}

/**
 * Trial Twilio accounts cannot use Content Templates.
 * Without a Content SID, send via the WhatsApp sandbox so messages can actually deliver.
 */
export function getEffectiveWhatsAppFrom(): string {
  if (getTwilioWhatsAppContentSid()) {
    return getTwilioWhatsAppFrom();
  }
  return getTwilioWhatsAppSandboxFrom();
}

export function isUsingWhatsAppSandbox(): boolean {
  return isTwilioWhatsAppSandboxSender(getEffectiveWhatsAppFrom());
}

/** Own WhatsApp Business senders require approved Content Templates outside the 24h session. */
export function requiresWhatsAppContentTemplate(): boolean {
  return isTwilioWhatsAppConfigured() && !isUsingWhatsAppSandbox();
}

export function isWhatsAppContentTemplateConfigured(): boolean {
  return Boolean(getTwilioWhatsAppContentSid());
}

export function shouldUseWhatsAppContentTemplate(): boolean {
  return isWhatsAppContentTemplateConfigured();
}

export function allowWhatsAppDevLogFallback(): boolean {
  return process.env.NODE_ENV !== "production" && optionalEnv("WHATSAPP_DEV_LOG") === "true";
}

export const WHATSAPP_VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const WHATSAPP_MAX_VERIFY_ATTEMPTS = 5;
