/**
 * Centralized environment validation.
 * Server-only secrets are never exposed via NEXT_PUBLIC_*.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function getNodeEnv(): "development" | "production" | "test" {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production" || env === "test") return env;
  return "development";
}

export function isProduction(): boolean {
  return getNodeEnv() === "production";
}

/** Validates Supabase public config (safe for browser). */
export function validatePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. See .env.example."
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example."
    );
  }
  return { url, anonKey };
}

/** Validates server-only secrets before webhook/admin operations. */
export function validateServerSecrets(): {
  serviceRoleKey: string;
  stripeSecret?: string;
  stripeWebhookSecret?: string;
  groqKey?: string;
  resendKey?: string;
  notificationRetrySecret?: string;
} {
  return {
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    stripeSecret: optionalEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET"),
    groqKey: optionalEnv("GROQ_API_KEY"),
    resendKey: optionalEnv("RESEND_API_KEY"),
    notificationRetrySecret: optionalEnv("NOTIFICATION_RETRY_SECRET"),
  };
}

export function getNotificationRetrySecret(): string | undefined {
  return optionalEnv("NOTIFICATION_RETRY_SECRET");
}

export function isCronAuthorized(request: Request): boolean {
  const secret = getNotificationRetrySecret();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

/** Constant-time string comparison to mitigate timing attacks on bearer tokens. */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isCronAuthorizedSecure(request: Request): boolean {
  const secret = getNotificationRetrySecret();
  if (!secret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return secureCompare(authHeader, expected);
}
