import type {
  PolicyLearningSuggestion,
  RefundApprovalBucket,
} from "./types";
import type { ActionPatternStats } from "./analyzer";
import { formatInrMajor } from "./amount";

const MIN_BUCKET_SAMPLES = 3;
const MIN_PATTERN_SAMPLES = 5;
const HIGH_APPROVAL_RATE = 85;
const VERY_HIGH_APPROVAL_RATE = 95;

export function buildPolicyLearningSuggestions(params: {
  currentThresholdInr: number;
  refundBuckets: RefundApprovalBucket[];
  actionPatterns: ActionPatternStats[];
}): PolicyLearningSuggestion[] {
  const suggestions: PolicyLearningSuggestion[] = [];

  const thresholdSuggestion = buildThresholdSuggestion(
    params.currentThresholdInr,
    params.refundBuckets
  );
  if (thresholdSuggestion) {
    suggestions.push(thresholdSuggestion);
  }

  const autoApproveSuggestion = buildAutoApprovePatternSuggestion(params.actionPatterns);
  if (autoApproveSuggestion) {
    suggestions.push(autoApproveSuggestion);
  }

  return suggestions.slice(0, 3);
}

function buildThresholdSuggestion(
  currentThresholdInr: number,
  buckets: RefundApprovalBucket[]
): PolicyLearningSuggestion | null {
  const mid = buckets.find((bucket) => bucket.id === "mid_range");
  if (!mid || mid.total < MIN_BUCKET_SAMPLES || mid.approvalRatePercent == null) {
    return null;
  }

  if (mid.approvalRatePercent < HIGH_APPROVAL_RATE) {
    return null;
  }

  const candidateThresholds = [7_000, 8_000, 10_000].filter(
    (value) => value > currentThresholdInr
  );
  const suggested = candidateThresholds[0];
  if (!suggested) {
    return null;
  }

  const lowerBandEnd = currentThresholdInr;
  const upperBandEnd = suggested;

  return {
    id: `raise-threshold-${suggested}`,
    kind: "raise_refund_threshold",
    title: `Lower threshold to ${formatInrMajor(suggested)}?`,
    detail: `You approve ${mid.approvalRatePercent}% of ${formatInrMajor(lowerBandEnd)}–${formatInrMajor(upperBandEnd)} refunds.`,
    thresholdInr: suggested,
    approvalRatePercent: mid.approvalRatePercent,
    sampleCount: mid.total,
  };
}

function buildAutoApprovePatternSuggestion(
  patterns: ActionPatternStats[]
): PolicyLearningSuggestion | null {
  const candidate = patterns.find((pattern) => {
    const total = pattern.approved + pattern.rejected;
    if (total < MIN_PATTERN_SAMPLES) {
      return false;
    }
    if (pattern.approvalRatePercent == null) {
      return false;
    }
    if (pattern.toolName.toLowerCase().includes("refund")) {
      return false;
    }
    return pattern.approvalRatePercent >= VERY_HIGH_APPROVAL_RATE;
  });

  if (!candidate || candidate.approvalRatePercent == null) {
    return null;
  }

  return {
    id: `auto-approve-${candidate.toolName}-${candidate.actionType}`,
    kind: "auto_approve_pattern",
    title: "Auto-approve low-risk patterns",
    detail: `Similar to '${candidate.label}' (${candidate.approvalRatePercent}% approved)`,
    toolName: candidate.toolName,
    actionLabel: candidate.label,
    sampleCount: candidate.approved + candidate.rejected,
    approvalRatePercent: candidate.approvalRatePercent,
  };
}
