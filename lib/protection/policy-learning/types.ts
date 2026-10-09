export type ApprovalOutcome = "approved" | "rejected";

export interface RefundApprovalBucket {
  id: "under_threshold" | "mid_range" | "over_high";
  label: string;
  minInr: number;
  maxInr: number | null;
  approved: number;
  rejected: number;
  total: number;
  approvalRatePercent: number | null;
}

export interface ApprovalPatternRow {
  label: string;
  approved: number;
  rejected: number;
  approvalRatePercent: number | null;
}

export type PolicyLearningSuggestionKind =
  | "raise_refund_threshold"
  | "auto_approve_pattern";

export interface PolicyLearningSuggestion {
  id: string;
  kind: PolicyLearningSuggestionKind;
  title: string;
  detail: string;
  /** Suggested refund threshold in INR when kind is raise_refund_threshold. */
  thresholdInr?: number;
  /** Tool name for auto-approve pattern suggestions. */
  toolName?: string;
  actionLabel?: string;
  sampleCount?: number;
  approvalRatePercent?: number;
}

export interface PolicyLearningView {
  currentThresholdInr: number;
  hasEnoughData: boolean;
  refundBuckets: RefundApprovalBucket[];
  suggestions: PolicyLearningSuggestion[];
  analyzedProposalCount: number;
  windowDays: number;
}
