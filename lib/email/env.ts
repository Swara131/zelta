function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** True when the URL host is unsuitable for links sent in email. */
export function isLocalOrPrivateAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "[::1]" ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

/** Resolves a configured app URL from environment (may be localhost in dev). */
export function resolveConfiguredAppUrl(): string | null {
  const railwayStaticUrl = optionalEnv("RAILWAY_STATIC_URL");
  if (railwayStaticUrl) {
    return normalizeUrl(
      railwayStaticUrl.startsWith("http")
        ? railwayStaticUrl
        : `https://${railwayStaticUrl}`
    );
  }

  const railwayDomain = optionalEnv("RAILWAY_PUBLIC_DOMAIN");
  if (railwayDomain) {
    return normalizeUrl(`https://${railwayDomain}`);
  }

  const candidates = [
    optionalEnv("APP_BASE_URL"),
    optionalEnv("PUBLIC_APP_URL"),
    optionalEnv("APPROVAL_BASE_URL"),
    optionalEnv("PUBLIC_URL"),
    optionalEnv("APP_URL"),
    optionalEnv("NEXT_PUBLIC_APP_URL"),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return normalizeUrl(candidate);
    }
  }

  return null;
}

export class EmailBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailBaseUrlError";
  }
}

/**
 * Public HTTPS base URL for links in approval emails.
 * Never returns localhost — throws so broken links are not sent silently.
 */
export function getEmailAppBaseUrl(): string {
  const configured = resolveConfiguredAppUrl();

  if (!configured) {
    throw new EmailBaseUrlError(
      "Missing public app URL for approval emails. Set APP_BASE_URL in .env.local to your public Wave URL (e.g. https://your-app.up.railway.app or an ngrok URL for phone testing). Approval emails cannot use localhost."
    );
  }

  if (isLocalOrPrivateAppUrl(configured)) {
    throw new EmailBaseUrlError(
      `Approval email links cannot use a local URL (${configured}). Set APP_BASE_URL to your public Wave URL (deployed domain or ngrok tunnel) so Approve/Deny works from email on any device.`
    );
  }

  return configured;
}

/** In-app / non-email links; localhost fallback is allowed for local browser use. */
export function getAppUrl(): string {
  return resolveConfiguredAppUrl() ?? "http://localhost:3000";
}

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

export const DEFAULT_MAX_RETRIES = 3;
