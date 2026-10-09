export type EmailApprovalAction = "approve" | "deny";

export function buildEmailApprovalActionUrl(
  baseUrl: string,
  action: EmailApprovalAction,
  plainToken: string
): string {
  const base = baseUrl.replace(/\/$/, "");
  const encoded = encodeURIComponent(plainToken);
  return `${base}/${action}/${encoded}`;
}

export function buildEmailApprovalReviewUrl(baseUrl: string, proposalId: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/approvals?proposal=${encodeURIComponent(proposalId)}`;
}
