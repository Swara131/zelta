const SECRET_KEY_PATTERN =
  /^(executiontoken|execution_token|token|apikey|api_key|plainkey|plain_key|secret|password|authorization|service_role|service_role_key|key_hash|token_hash|resend_api_key|bearer|cookie)$/i;

const SECRET_VALUE_PATTERN = /^(et_|al_|al_rev_)[a-z0-9_+-]+$/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (SECRET_KEY_PATTERN.test(key)) {
      return "[redacted]";
    }
    if (SECRET_VALUE_PATTERN.test(trimmed) && trimmed.length > 16) {
      return "[redacted]";
    }
    return trimmed.length > 500 ? `${trimmed.slice(0, 499)}…` : trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(`${key}[${index}]`, item));
  }

  if (typeof value === "object") {
    return sanitizeActionParameters(value as Record<string, unknown>);
  }

  return value;
}

/** Redacts secrets and truncates values before writing safety audit metadata. */
export function sanitizeActionParameters(
  parameters: Record<string, unknown> = {}
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}
