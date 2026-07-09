import type { SupabaseClient } from "@supabase/supabase-js";
import { ApprovalEngineError } from "./errors";

export interface ApprovalDashboardStats {
  /** Pending human review */
  pending: number;
  /** Pending with critical severity */
  critical: number;
  /** Pending with P1 priority */
  p1: number;
  /** All-time counts */
  total: number;
  approved: number;
  rejected: number;
  autoApproved: number;
  changesRequested: number;
  escalated: number;
  /** Average resolution time in minutes (resolved requests only) */
  avgResolutionMinutes: number | null;
  /** Approval success rate (approved + auto / finalized) */
  successRatePercent: number | null;
  /** Decisions recorded today */
  decisionsToday: number;
}

type RequestRow = {
  status: string;
  risk_severity: string;
  priority: string;
  required_approvals: number;
  submitted_at: string;
  resolved_at: string | null;
};

function minutesBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

export async function getApprovalDashboardStats(
  supabase: SupabaseClient,
  organizationId?: string
): Promise<ApprovalDashboardStats> {
  let requestQuery = supabase
    .from("approval_requests")
    .select(
      "status, risk_severity, priority, required_approvals, submitted_at, resolved_at"
    );

  if (organizationId) {
    requestQuery = requestQuery.eq("organization_id", organizationId);
  }

  const { data: requests, error: requestError } = await requestQuery;

  if (requestError) {
    throw new ApprovalEngineError(requestError.message);
  }

  const rows = (requests ?? []) as RequestRow[];

  const pending = rows.filter((row) => row.status === "pending");
  const approved = rows.filter((row) => row.status === "approved");
  const rejected = rows.filter((row) => row.status === "rejected");
  const changesRequested = rows.filter((row) => row.status === "changes_requested");
  const escalated = rows.filter((row) => row.status === "escalated");

  const autoApproved = approved.filter((row) => row.required_approvals === 0).length;

  const resolved = rows.filter((row) => row.resolved_at);
  const resolutionMinutes = resolved
    .map((row) => minutesBetween(row.submitted_at, row.resolved_at!))
    .filter((m) => m >= 0);

  const avgResolutionMinutes =
    resolutionMinutes.length > 0
      ? Math.round(
          resolutionMinutes.reduce((sum, value) => sum + value, 0) /
            resolutionMinutes.length
        )
      : null;

  const finalized = approved.length + rejected.length + changesRequested.length + escalated.length;
  const successNumerator = approved.length;
  const successRatePercent =
    finalized > 0 ? Math.round((successNumerator / finalized) * 1000) / 10 : null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let historyQuery = supabase
    .from("approval_history")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfToday.toISOString())
    .in("action", [
      "approved",
      "rejected",
      "changes_requested",
      "escalated",
      "auto_approved",
    ]);

  if (organizationId) {
    historyQuery = historyQuery.eq("organization_id", organizationId);
  }

  const { count: decisionsToday, error: historyError } = await historyQuery;

  if (historyError) {
    throw new ApprovalEngineError(historyError.message);
  }

  return {
    pending: pending.length,
    critical: pending.filter((row) => row.risk_severity === "critical").length,
    p1: pending.filter((row) => row.priority === "p1").length,
    total: rows.length,
    approved: approved.length,
    rejected: rejected.length,
    autoApproved,
    changesRequested: changesRequested.length,
    escalated: escalated.length,
    avgResolutionMinutes,
    successRatePercent,
    decisionsToday: decisionsToday ?? 0,
  };
}

/** KPI-friendly subset for analytics dashboard API */
export function formatApprovalTimeKpi(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatSuccessRateKpi(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate}%`;
}
