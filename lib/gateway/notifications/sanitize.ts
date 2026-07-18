const SECRET_PATTERN =
  /^(authorization|cookie|apikey|api_key|executiontoken|execution_token|token|secret|password|service_role|service_role_key|key_hash|token_hash|plainkey|plain_key|resend_api_key)$/i;

const TOKEN_VALUE_PATTERN = /^(et_|al_)[a-z0-9_+-]{16,}$/i;

/** Redacts secrets and truncates text for email-safe display. */
export function sanitizeNotificationText(value: string, maxLength = 500): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (TOKEN_VALUE_PATTERN.test(trimmed)) {
    return "[redacted]";
  }

  const withoutJsonSecrets = trimmed.replace(
    /"(api[_-]?key|token|secret|password|authorization)"\s*:\s*"[^"]+"/gi,
    '"$1":"[redacted]"'
  );

  return withoutJsonSecrets.length > maxLength
    ? `${withoutJsonSecrets.slice(0, maxLength - 1)}…`
    : withoutJsonSecrets;
}

export function isSensitiveNotificationField(key: string): boolean {
  return SECRET_PATTERN.test(key.trim());
}

export function buildApprovalsReviewUrl(proposalId: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/approvals?proposal=${encodeURIComponent(proposalId)}`;
}
