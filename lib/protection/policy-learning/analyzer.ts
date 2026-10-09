import type { ApprovalOutcome, RefundApprovalBucket } from "./types";
import { extractInrMajorFromPayload, formatInrMajor } from "./amount";

export interface ProposalLearningRecord {
  toolName: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  status: string;
  plainEnglishSummary?: string | null;
}

const APPROVED_STATUSES = new Set(["allowed", "approved"]);
const REJECTED_STATUSES = new Set(["rejected", "blocked"]);

export function classifyProposalOutcome(status: string): ApprovalOutcome | null {
  if (APPROVED_STATUSES.has(status)) {
    return "approved";
  }
  if (REJECTED_STATUSES.has(status)) {
    return "rejected";
  }
  return null;
}

export function isRefundProposal(record: ProposalLearningRecord): boolean {
  const tool = record.toolName.toLowerCase();
  const action = record.actionType.toLowerCase();
  return tool.includes("refund") || action.includes("refund");
}

function approvalRate(approved: number, rejected: number): number | null {
  const total = approved + rejected;
  if (total === 0) {
    return null;
  }
  return Math.round((approved / total) * 100);
}

export function buildRefundApprovalBuckets(params: {
  records: ProposalLearningRecord[];
  thresholdInr: number;
  highBandInr?: number;
}): RefundApprovalBucket[] {
  const highBand = params.highBandInr ?? 10_000;
  const buckets = {
    under_threshold: { approved: 0, rejected: 0 },
    mid_range: { approved: 0, rejected: 0 },
    over_high: { approved: 0, rejected: 0 },
  };

  for (const record of params.records) {
    if (!isRefundProposal(record)) {
      continue;
    }

    const outcome = classifyProposalOutcome(record.status);
    if (!outcome) {
      continue;
    }

    const amount = extractInrMajorFromPayload(record.actionPayload);
    if (amount == null) {
      continue;
    }

    let key: keyof typeof buckets;
    if (amount < params.thresholdInr) {
      key = "under_threshold";
    } else if (amount < highBand) {
      key = "mid_range";
    } else {
      key = "over_high";
    }

    buckets[key][outcome] += 1;
  }

  const thresholdLabel = formatInrMajor(params.thresholdInr);
  const highLabel = formatInrMajor(highBand);

  return [
    {
      id: "under_threshold",
      label: `Refunds under ${thresholdLabel}`,
      minInr: 0,
      maxInr: params.thresholdInr,
      ...buckets.under_threshold,
      total: buckets.under_threshold.approved + buckets.under_threshold.rejected,
      approvalRatePercent: approvalRate(
        buckets.under_threshold.approved,
        buckets.under_threshold.rejected
      ),
    },
    {
      id: "mid_range",
      label: `Refunds ${thresholdLabel}–${highLabel}`,
      minInr: params.thresholdInr,
      maxInr: highBand,
      ...buckets.mid_range,
      total: buckets.mid_range.approved + buckets.mid_range.rejected,
      approvalRatePercent: approvalRate(
        buckets.mid_range.approved,
        buckets.mid_range.rejected
      ),
    },
    {
      id: "over_high",
      label: `Refunds over ${highLabel}`,
      minInr: highBand,
      maxInr: null,
      ...buckets.over_high,
      total: buckets.over_high.approved + buckets.over_high.rejected,
      approvalRatePercent: approvalRate(
        buckets.over_high.approved,
        buckets.over_high.rejected
      ),
    },
  ];
}

export interface ActionPatternStats {
  toolName: string;
  actionType: string;
  label: string;
  approved: number;
  rejected: number;
  approvalRatePercent: number | null;
}

export function buildActionPatternStats(
  records: ProposalLearningRecord[]
): ActionPatternStats[] {
  const groups = new Map<
    string,
    { toolName: string; actionType: string; label: string; approved: number; rejected: number }
  >();

  for (const record of records) {
    const outcome = classifyProposalOutcome(record.status);
    if (!outcome) {
      continue;
    }

    const key = `${record.toolName}::${record.actionType}`;
    const existing = groups.get(key) ?? {
      toolName: record.toolName,
      actionType: record.actionType,
      label: describeActionPatternLabel(record),
      approved: 0,
      rejected: 0,
    };

    existing[outcome] += 1;
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      approvalRatePercent: approvalRate(group.approved, group.rejected),
    }))
    .sort((a, b) => b.approved + b.rejected - (a.approved + a.rejected));
}

function describeActionPatternLabel(record: ProposalLearningRecord): string {
  const tool = record.toolName.toLowerCase();
  const action = record.actionType.toLowerCase();

  if (tool.includes("email") || action.includes("email")) {
    return "Confirm customer email";
  }
  if (tool.includes("refund") || action.includes("refund")) {
    return "Issue refund";
  }
  if (tool.includes("export") || action.includes("export")) {
    return "Export customer data";
  }

  const summary = record.plainEnglishSummary?.trim();
  if (summary && summary.length <= 48) {
    return summary;
  }

  return record.toolName.replace(/_/g, " ");
}
