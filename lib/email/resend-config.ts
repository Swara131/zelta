const PLACEHOLDER_FROM_PATTERNS = [
  /yourdomain\.com/i,
  /example\.com/i,
  /changeme/i,
  /placeholder/i,
  /@localhost/i,
];

export function parseFromEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

export interface ResendConfigStatus {
  configured: boolean;
  error: string | null;
  sandboxMode: boolean;
  sandboxRecipient: string | null;
}

const RESEND_SANDBOX_FROM = "onboarding@resend.dev";

export function isResendSandboxSender(fromAddress: string): boolean {
  return fromAddress.toLowerCase() === RESEND_SANDBOX_FROM;
}

/** Inbox allowed when using Resend's onboarding@resend.dev sandbox sender. */
export function getResendSandboxRecipient(): string | null {
  const configured = process.env.RESEND_SANDBOX_RECIPIENT?.trim();
  if (configured && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) {
    return configured;
  }
  return null;
}

export function isAllowedResendSandboxRecipient(email: string): boolean {
  const allowed = getResendSandboxRecipient();
  if (!allowed) return true;
  return email.trim().toLowerCase() === allowed.toLowerCase();
}

export function resendSandboxRecipientWarning(destinationEmail: string): string | null {
  const fromRaw = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromRaw) return null;

  const fromAddress = parseFromEmailAddress(fromRaw);
  if (!isResendSandboxSender(fromAddress)) return null;

  const allowed = getResendSandboxRecipient();
  if (!allowed) {
    return "Resend is in test mode (onboarding@resend.dev). Set RESEND_SANDBOX_RECIPIENT in .env.local to your Resend account email, or verify a domain to send anywhere.";
  }

  if (!isAllowedResendSandboxRecipient(destinationEmail)) {
    return `Resend test mode only delivers to ${allowed}. Change the destination email, or verify a domain at resend.com/domains.`;
  }

  return null;
}

/** Validates Resend env vars without throwing. Used before agent email delivery. */
export function getResendConfigStatus(): ResendConfigStatus {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromRaw = process.env.RESEND_FROM_EMAIL?.trim();

  const sandboxRecipient = getResendSandboxRecipient();

  if (!apiKey) {
    return {
      configured: false,
      error: "RESEND_API_KEY is missing. Add it to .env.local.",
      sandboxMode: false,
      sandboxRecipient: null,
    };
  }

  if (!fromRaw) {
    return {
      configured: false,
      error: "RESEND_FROM_EMAIL is missing. Add it to .env.local.",
      sandboxMode: false,
      sandboxRecipient: null,
    };
  }

  const address = parseFromEmailAddress(fromRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return {
      configured: false,
      error: "RESEND_FROM_EMAIL is invalid. Use format: Wave <sender@your-verified-domain.com>.",
      sandboxMode: false,
      sandboxRecipient: null,
    };
  }

  const sandboxMode = isResendSandboxSender(address);

  for (const pattern of PLACEHOLDER_FROM_PATTERNS) {
    if (pattern.test(address) || pattern.test(fromRaw)) {
      return {
        configured: false,
        error:
          "RESEND_FROM_EMAIL uses a placeholder domain. Verify a sender domain in Resend and update .env.local, or for local testing set RESEND_FROM_EMAIL=Wave <onboarding@resend.dev> (Resend sandbox — delivers to your Resend account email only).",
        sandboxMode,
        sandboxRecipient,
      };
    }
  }

  return { configured: true, error: null, sandboxMode, sandboxRecipient };
}

/** Maps Resend API errors to actionable delivery messages. */
export function formatResendDeliveryError(message: string): string {
  if (/only send testing emails to your own email address/i.test(message)) {
    const match = message.match(/\(([^)]+@[^)]+)\)/);
    const allowed = match?.[1] ?? getResendSandboxRecipient();
    if (allowed) {
      return `Resend test mode only delivers to ${allowed}. Update the agent destination email, or verify a domain at resend.com/domains.`;
    }
  }
  if (/domain is not verified/i.test(message)) {
    return `${message} Update RESEND_FROM_EMAIL in .env.local to a verified sender domain in Resend, or use Wave <onboarding@resend.dev> for local sandbox testing.`;
  }
  return message;
}
