/** What happens when a review deadline passes without human action. */
export type ReviewTimeoutBehavior = "auto_deny" | "escalate";

const TIMEOUT_BEHAVIORS = new Set<ReviewTimeoutBehavior>(["auto_deny", "escalate"]);

export function parseReviewTimeoutBehavior(
  value: string | undefined
): ReviewTimeoutBehavior {
  const normalized = value?.trim().toLowerCase();
  if (normalized && TIMEOUT_BEHAVIORS.has(normalized as ReviewTimeoutBehavior)) {
    return normalized as ReviewTimeoutBehavior;
  }
  return "auto_deny";
}

export function parseReviewDeadlineHours(value: string | undefined): number {
  const parsed = Number(value?.trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 4;
}

export function parseReviewEscalationMaxLevel(value: string | undefined): number {
  const parsed = Number(value?.trim());
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 3;
}

export function getReviewTimeoutBehavior(): ReviewTimeoutBehavior {
  return parseReviewTimeoutBehavior(process.env.REVIEW_TIMEOUT_BEHAVIOR);
}

export function getReviewDeadlineHours(): number {
  return parseReviewDeadlineHours(process.env.REVIEW_DEADLINE_HOURS);
}

export function getReviewEscalationMaxLevel(): number {
  return parseReviewEscalationMaxLevel(process.env.REVIEW_ESCALATION_MAX_LEVEL);
}

export function computeReviewExpiresAt(params: {
  reviewRequestedAt: Date;
  proposalExpiresAt: string;
  deadlineHours?: number;
}): string {
  const hours = params.deadlineHours ?? getReviewDeadlineHours();
  const proposalCap = new Date(params.proposalExpiresAt);
  const candidate = new Date(
    params.reviewRequestedAt.getTime() + hours * 60 * 60 * 1000
  );
  const effective = candidate.getTime() > proposalCap.getTime() ? proposalCap : candidate;
  return effective.toISOString();
}
