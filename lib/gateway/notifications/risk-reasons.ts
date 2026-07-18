import type { StoredRiskReasons } from "@/lib/gateway/proposals/enrichment";
import { extractMatchedPoliciesFromRiskReasons } from "@/lib/gateway/proposals/enrichment";
import { sanitizeNotificationText } from "./sanitize";

const MAX_REASONS = 5;

export function parseStoredRiskReasons(value: unknown): StoredRiskReasons {
  if (typeof value === "object" && value !== null && "matchedPolicies" in value) {
    return value as StoredRiskReasons;
  }
  return { matchedPolicies: extractMatchedPoliciesFromRiskReasons(value) };
}

/** Builds concise, sanitized risk reasons for reviewer emails. */
export function extractConciseRiskReasons(riskReasons: unknown): string[] {
  const stored = parseStoredRiskReasons(riskReasons);
  const reasons: string[] = [];

  for (const policy of stored.matchedPolicies ?? []) {
    const reason = policy.reason?.trim();
    if (reason) {
      reasons.push(sanitizeNotificationText(`${policy.name}: ${reason}`, 200));
    } else if (policy.name) {
      reasons.push(sanitizeNotificationText(`Policy matched: ${policy.name}`, 200));
    }
  }

  for (const reason of stored.ai?.riskReasons ?? []) {
    if (typeof reason === "string" && reason.trim()) {
      reasons.push(sanitizeNotificationText(reason, 200));
    }
  }

  const unique = [...new Set(reasons.filter(Boolean))];
  return unique.slice(0, MAX_REASONS);
}

export function sanitizePlainEnglishSummary(summary: string | null | undefined): string {
  const fallback = "Agent action requires human review before execution.";
  return sanitizeNotificationText(summary?.trim() || fallback, 800);
}
