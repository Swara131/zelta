import type { PendingApproval } from "@/lib/approval-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parses and validates a proposal deep-link query parameter. */
export function parseProposalDeepLinkParam(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Finds a proposal within the authorized list returned for the current org.
 * Returns null when missing or not visible to the caller (no cross-org leak).
 */
export function findAuthorizedProposalForDeepLink(
  approvals: PendingApproval[],
  proposalId: string | null
): PendingApproval | null {
  if (!proposalId) {
    return null;
  }
  return approvals.find((approval) => approval.id === proposalId) ?? null;
}

export type ProposalDeepLinkFilter = "all" | "critical" | "high" | "medium" | "low";

/** Whether the active severity filter hides the target proposal. */
export function shouldClearFilterForDeepLink(
  filter: ProposalDeepLinkFilter,
  approval: PendingApproval
): boolean {
  return filter !== "all" && approval.riskSeverity !== filter;
}
