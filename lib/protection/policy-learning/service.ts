import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildActionPatternStats,
  buildRefundApprovalBuckets,
} from "./analyzer";
import { listProposalLearningRecords } from "./repository";
import { buildPolicyLearningSuggestions } from "./suggestions";
import type { PolicyLearningView } from "./types";

const DEFAULT_THRESHOLD_INR = 5_000;

export function parseCurrentThresholdInr(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return DEFAULT_THRESHOLD_INR;
}

export async function buildPolicyLearningView(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    currentThresholdInr?: number;
    windowDays?: number;
  }
): Promise<PolicyLearningView> {
  const currentThresholdInr = parseCurrentThresholdInr(params.currentThresholdInr);
  const windowDays = params.windowDays ?? 90;
  const records = await listProposalLearningRecords(
    supabase,
    params.organizationId,
    windowDays
  );

  const refundBuckets = buildRefundApprovalBuckets({
    records,
    thresholdInr: currentThresholdInr,
  });
  const actionPatterns = buildActionPatternStats(records);
  const suggestions = buildPolicyLearningSuggestions({
    currentThresholdInr,
    refundBuckets,
    actionPatterns,
  });

  const decidedCount = records.filter(
    (record) => record.status === "allowed" ||
      record.status === "approved" ||
      record.status === "rejected" ||
      record.status === "blocked"
  ).length;

  const hasEnoughData = refundBuckets.some((bucket) => bucket.total >= 3) || decidedCount >= 5;

  return {
    currentThresholdInr,
    hasEnoughData,
    refundBuckets,
    suggestions,
    analyzedProposalCount: records.length,
    windowDays,
  };
}
