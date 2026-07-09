function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value;
}

export function getResendApiKey(): string {
  return requireEnv("RESEND_API_KEY");
}

export function getResendFromEmail(): string {
  return requireEnv("RESEND_FROM_EMAIL");
}

/** Public app URL for CTA links in emails */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export const DEFAULT_MAX_RETRIES = 3;
