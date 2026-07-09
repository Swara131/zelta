export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

type SupabaseAuthError = {
  message?: unknown;
  msg?: unknown;
  code?: string;
  status?: number;
};

function readErrorText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error.message.trim()
      ? error
      : new AuthError("Authentication failed. Please try again.");
  }

  if (error && typeof error === "object") {
    const authErr = error as SupabaseAuthError;
    const message =
      readErrorText(authErr.message) ||
      readErrorText(authErr.msg) ||
      (authErr.code ? `Authentication failed (${authErr.code}).` : undefined) ||
      "Authentication failed. Please try again.";

    return new AuthError(message);
  }

  return new AuthError("Authentication failed. Please try again.");
}

export function formatAuthErrorMessage(detail: string): string {
  const lower = detail.toLowerCase();

  if (lower.includes("database error saving new user")) {
    return "Database error saving new user — run in Supabase SQL Editor: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;";
  }

  if (lower.includes("rate limit") || lower.includes("rate_limit")) {
    return "Too many signup emails sent. Wait about an hour, try signing in instead, or disable email confirmation in Supabase (Authentication → Providers → Email) for local dev.";
  }

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  return detail;
}

export function formatUnknownAuthError(err: unknown, fallback: string): string {
  if (err instanceof AuthError || err instanceof Error) {
    const message = err.message.trim();
    if (message && message !== "{}") return formatAuthErrorMessage(message);
  }

  if (err && typeof err === "object") {
    const authErr = err as SupabaseAuthError;
    const message = readErrorText(authErr.message) || readErrorText(authErr.msg);
    if (message && message !== "{}") return formatAuthErrorMessage(message);
  }

  return fallback;
}
