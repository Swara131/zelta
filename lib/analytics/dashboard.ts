import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityItem,
  AnalyticsData,
  DepartmentStat,
  HeatmapCell,
  PieSlice,
  TrendPoint,
  UserRank,
} from "@/lib/analytics-types";
import type { AuditAction } from "@/lib/audit/types";
import { mapAuditRowToTimelineEntry } from "@/lib/audit/repository";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  formatApprovalTimeKpi,
  getApprovalDashboardStats,
} from "@/lib/approvals/stats";
import {
  ACTION_PIE_COLORS,
  DAY_LABELS,
  DEPARTMENT_COLORS,
  MONTH_LABELS,
} from "./constants";
import { AnalyticsError } from "./errors";
import {
  addDays,
  buildKpi,
  initials,
  isoDateKey,
  maxSeverity,
  severityToRiskScore,
  startOfDay,
} from "./helpers";

type AuditEventRow = {
  id: string;
  action: AuditAction;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  entity_type: string;
  risk_severity: RiskSeverity | null;
  approval_status: string | null;
  users: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
};

type ApprovalStatusRow = {
  status: string;
  required_approvals: number;
  risk_severity: RiskSeverity;
  agent_id: string;
  affected_systems: string[];
  submitted_at: string;
  resolved_at: string | null;
};

type TranslationSystemRow = {
  affected_system: string;
};

type RiskTrendRow = {
  overall_score: number;
  created_at: string;
};

const BLOCKED_STATUSES = new Set(["rejected", "escalated", "changes_requested"]);
const BLOCKED_ACTIONS = new Set<AuditAction>(["reject", "escalate"]);

function normalizeUser(
  users: AuditEventRow["users"]
): { email: string; full_name: string | null } | null {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

function displayUser(
  user: { email: string; full_name: string | null } | null,
  fallback: string
): string {
  if (!user) return fallback;
  return user.full_name?.trim() || user.email || fallback;
}

function auditToActivityType(action: AuditAction): ActivityItem["type"] {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "escalate":
      return "escalated";
    case "upload":
      return "upload";
    case "analyze":
      return "risk";
    default:
      return "blocked";
  }
}

function lastSevenDayKeys(now: Date): { key: string; label: string }[] {
  const today = startOfDay(now);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6);
    return {
      key: isoDateKey(day),
      label: DAY_LABELS[day.getDay()],
    };
  });
}

function lastSixMonthKeys(now: Date): { key: string; label: string }[] {
  const keys: { key: string; label: string }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    keys.push({ key, label: MONTH_LABELS[month.getMonth()] });
  }
  return keys;
}

async function countUploadsSince(
  supabase: SupabaseClient,
  organizationId: string,
  since: string,
  until?: string
): Promise<number> {
  let query = supabase
    .from("uploaded_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", since);

  if (until) {
    query = query.lt("created_at", until);
  }

  const { count, error } = await query;
  if (error) throw new AnalyticsError(error.message);
  return count ?? 0;
}

async function fetchAuditEvents(
  supabase: SupabaseClient,
  organizationId: string,
  since: string
): Promise<AuditEventRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, user_id, created_at, metadata, entity_type, risk_severity, approval_status, users(email, full_name)"
    )
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) throw new AnalyticsError(error.message);
  return (data ?? []) as unknown as AuditEventRow[];
}

async function fetchRecentAudit(
  supabase: SupabaseClient,
  organizationId: string,
  limit: number
): Promise<AuditEventRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, user_id, created_at, metadata, entity_type, risk_severity, approval_status, users(email, full_name)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new AnalyticsError(error.message);
  return (data ?? []) as unknown as AuditEventRow[];
}

function buildWeeklyTrend(
  auditEvents: AuditEventRow[],
  riskRows: RiskTrendRow[],
  dayKeys: { key: string; label: string }[]
): TrendPoint[] {
  const actionCounts = new Map<string, number>();
  const blockedCounts = new Map<string, number>();
  const riskCounts = new Map<string, number>();

  for (const event of auditEvents) {
    const key = event.created_at.slice(0, 10);
    actionCounts.set(key, (actionCounts.get(key) ?? 0) + 1);
    if (BLOCKED_ACTIONS.has(event.action)) {
      blockedCounts.set(key, (blockedCounts.get(key) ?? 0) + 1);
    }
  }

  for (const row of riskRows) {
    const key = row.created_at.slice(0, 10);
    riskCounts.set(key, (riskCounts.get(key) ?? 0) + 1);
  }

  return dayKeys.map(({ key, label }) => ({
    label,
    value: actionCounts.get(key) ?? 0,
    secondary: (blockedCounts.get(key) ?? 0) + (riskCounts.get(key) ?? 0),
  }));
}

function buildMonthlyTrend(
  auditEvents: AuditEventRow[],
  riskRows: RiskTrendRow[],
  monthKeys: { key: string; label: string }[]
): TrendPoint[] {
  const actionCounts = new Map<string, number>();
  const riskScoreTotals = new Map<string, { sum: number; count: number }>();

  for (const event of auditEvents) {
    const monthKey = event.created_at.slice(0, 7);
    actionCounts.set(monthKey, (actionCounts.get(monthKey) ?? 0) + 1);
  }

  for (const row of riskRows) {
    const monthKey = row.created_at.slice(0, 7);
    const bucket = riskScoreTotals.get(monthKey) ?? { sum: 0, count: 0 };
    bucket.sum += row.overall_score;
    bucket.count += 1;
    riskScoreTotals.set(monthKey, bucket);
  }

  return monthKeys.map(({ key, label }) => {
    const riskBucket = riskScoreTotals.get(key);
    return {
      label,
      value: actionCounts.get(key) ?? 0,
      secondary: riskBucket ? Math.round(riskBucket.sum / riskBucket.count) : 0,
    };
  });
}

function buildHeatmap(auditEvents: AuditEventRow[]): HeatmapCell[] {
  const counts = new Map<string, number>();

  for (const event of auditEvents) {
    const date = new Date(event.created_at);
    const cellKey = `${date.getDay()}-${date.getHours()}`;
    counts.set(cellKey, (counts.get(cellKey) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.push({
        day,
        hour,
        value: counts.get(`${day}-${hour}`) ?? 0,
      });
    }
  }
  return cells;
}

function buildActionTypePie(approvals: ApprovalStatusRow[]): PieSlice[] {
  const approved = approvals.filter((row) => row.status === "approved");
  const autoApproved = approved.filter((row) => row.required_approvals === 0).length;
  const manualApproved = approved.length - autoApproved;
  const blocked = approvals.filter((row) => BLOCKED_STATUSES.has(row.status)).length;
  const pending = approvals.filter((row) => row.status === "pending").length;
  const escalated = approvals.filter((row) => row.status === "escalated").length;

  const slices: PieSlice[] = [
    { label: "Approved", value: manualApproved, color: ACTION_PIE_COLORS.Approved },
    { label: "Auto-approved", value: autoApproved, color: ACTION_PIE_COLORS["Auto-approved"] },
    { label: "Blocked", value: blocked, color: ACTION_PIE_COLORS.Blocked },
    { label: "Pending", value: pending, color: ACTION_PIE_COLORS.Pending },
    { label: "Escalated", value: escalated, color: ACTION_PIE_COLORS.Escalated },
  ];

  return slices.filter((slice) => slice.value > 0);
}

function buildDepartmentPie(systemRows: TranslationSystemRow[]): PieSlice[] {
  const counts = new Map<string, number>();
  for (const row of systemRows) {
    const system = row.affected_system.trim() || "Other";
    counts.set(system, (counts.get(system) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return sorted.map(([label, value], index) => ({
    label,
    value,
    color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
  }));
}

function buildDepartmentStats(approvals: ApprovalStatusRow[]): DepartmentStat[] {
  const stats = new Map<string, { actions: number; blocked: number; approved: number }>();

  for (const row of approvals) {
    const systems =
      row.affected_systems.length > 0 ? row.affected_systems : ["General"];
    for (const system of systems) {
      const name = system.trim() || "General";
      const bucket = stats.get(name) ?? { actions: 0, blocked: 0, approved: 0 };
      bucket.actions += 1;
      if (BLOCKED_STATUSES.has(row.status)) bucket.blocked += 1;
      if (row.status === "approved") bucket.approved += 1;
      stats.set(name, bucket);
    }
  }

  return [...stats.entries()]
    .sort((a, b) => b[1].actions - a[1].actions)
    .slice(0, 5)
    .map(([name, bucket], index) => ({
      name,
      actions: bucket.actions,
      blocked: bucket.blocked,
      approvalRate:
        bucket.actions > 0
          ? Math.round((bucket.approved / bucket.actions) * 1000) / 10
          : 0,
      color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
    }));
}

function buildTopRiskyUsers(approvals: ApprovalStatusRow[]): UserRank[] {
  const agents = new Map<
    string,
    { count: number; severity: RiskSeverity; system: string }
  >();

  for (const row of approvals) {
    const agent = row.agent_id || "unknown-agent";
    const existing = agents.get(agent);
    const system = row.affected_systems[0] ?? "Automation";
    if (!existing) {
      agents.set(agent, { count: 1, severity: row.risk_severity, system });
    } else {
      existing.count += 1;
      existing.severity = maxSeverity(existing.severity, row.risk_severity);
    }
  }

  return [...agents.entries()]
    .sort((a, b) => {
      const scoreDiff =
        severityToRiskScore(b[1].severity) - severityToRiskScore(a[1].severity);
      return scoreDiff !== 0 ? scoreDiff : b[1].count - a[1].count;
    })
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      department: data.system,
      count: data.count,
      riskScore: severityToRiskScore(data.severity),
      avatar: initials(name),
    }));
}

function buildMostActiveUsers(auditEvents: AuditEventRow[]): UserRank[] {
  const users = new Map<
    string,
    { count: number; name: string; department: string }
  >();

  for (const event of auditEvents) {
    if (!event.user_id) continue;
    const user = normalizeUser(event.users);
    const name = displayUser(user, event.user_id);
    const department =
      typeof event.metadata?.department === "string"
        ? event.metadata.department
        : event.entity_type || "Platform";

    const existing = users.get(event.user_id);
    if (!existing) {
      users.set(event.user_id, { count: 1, name, department });
    } else {
      existing.count += 1;
    }
  }

  return [...users.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([, data]) => ({
      name: data.name,
      department: data.department,
      count: data.count,
      avatar: initials(data.name),
    }));
}

function buildRecentActivity(rows: AuditEventRow[]): ActivityItem[] {
  return rows.map((row) => {
    const entry = mapAuditRowToTimelineEntry(
      row as Parameters<typeof mapAuditRowToTimelineEntry>[0]
    );
    return {
      id: entry.id,
      type: auditToActivityType(entry.action),
      title: entry.title,
      description: entry.description,
      actor: entry.actor,
      timestamp: entry.timestamp,
    };
  });
}

function countBlockedInRange(
  auditEvents: AuditEventRow[],
  startKey: string,
  endKey?: string
): number {
  return auditEvents.filter((event) => {
    const key = event.created_at.slice(0, 10);
    if (key < startKey) return false;
    if (endKey && key >= endKey) return false;
    return BLOCKED_ACTIONS.has(event.action);
  }).length;
}

/**
 * Builds the full analytics dashboard payload from Supabase.
 * Uses parallel scoped queries and in-memory aggregation to minimize round trips.
 */
export async function getAnalyticsDashboard(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<AnalyticsData> {
  const organizationId = await ensureOrganization(supabase, userId, userEmail);
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -6);
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const activeUsersSince = addDays(todayStart, -30);

  const todayIso = todayStart.toISOString();
  const yesterdayIso = yesterdayStart.toISOString();
  const weekIso = weekStart.toISOString();
  const sixMonthsIso = sixMonthsStart.toISOString();
  const activeUsersIso = activeUsersSince.toISOString();

  const dayKeys = lastSevenDayKeys(now);
  const monthKeys = lastSixMonthKeys(now);

  const [
    approvalStats,
    uploadsToday,
    uploadsYesterday,
    approvalRows,
    translationSystems,
    riskTrendRows,
    auditEventsSixMonths,
    recentAuditRows,
  ] = await Promise.all([
    getApprovalDashboardStats(supabase, organizationId),
    countUploadsSince(supabase, organizationId, todayIso),
    countUploadsSince(supabase, organizationId, yesterdayIso, todayIso),
    supabase
      .from("approval_requests")
      .select(
        "status, required_approvals, risk_severity, agent_id, affected_systems, submitted_at, resolved_at"
      )
      .eq("organization_id", organizationId)
      .then(({ data, error }) => {
        if (error) throw new AnalyticsError(error.message);
        return (data ?? []) as ApprovalStatusRow[];
      }),
    supabase
      .from("translations")
      .select("affected_system")
      .eq("organization_id", organizationId)
      .then(({ data, error }) => {
        if (error) throw new AnalyticsError(error.message);
        return (data ?? []) as TranslationSystemRow[];
      }),
    supabase
      .from("risk_analysis")
      .select("overall_score, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", sixMonthsIso)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new AnalyticsError(error.message);
        return (data ?? []) as RiskTrendRow[];
      }),
    fetchAuditEvents(supabase, organizationId, sixMonthsIso),
    fetchRecentAudit(supabase, organizationId, 7),
  ]);

  const weekAuditEvents = auditEventsSixMonths.filter(
    (event) => event.created_at >= weekIso
  );
  const activeUserAuditEvents = auditEventsSixMonths.filter(
    (event) => event.created_at >= activeUsersIso
  );

  const blockedTotal =
    approvalStats.rejected + approvalStats.escalated + approvalStats.changesRequested;

  const todayKey = isoDateKey(todayStart);
  const yesterdayKey = isoDateKey(yesterdayStart);
  const blockedToday = countBlockedInRange(weekAuditEvents, todayKey);
  const blockedYesterday = countBlockedInRange(
    weekAuditEvents,
    yesterdayKey,
    todayKey
  );

  const weeklyTrend = buildWeeklyTrend(weekAuditEvents, riskTrendRows, dayKeys);
  const monthlyTrend = buildMonthlyTrend(auditEventsSixMonths, riskTrendRows, monthKeys);

  const actionTypePie = buildActionTypePie(approvalRows);
  const departmentPie = buildDepartmentPie(translationSystems);
  const departments = buildDepartmentStats(approvalRows);
  const topRiskyUsers = buildTopRiskyUsers(approvalRows);
  const mostActiveUsers = buildMostActiveUsers(activeUserAuditEvents);
  const heatmap = buildHeatmap(weekAuditEvents);
  const recentActivity = buildRecentActivity(recentAuditRows);

  const emptyUser = {
    name: "No activity yet",
    department: "—",
    count: 1,
    avatar: "NA",
  };

  return {
    kpis: {
      todaysActions: buildKpi(
        "Today's Uploads",
        uploadsToday,
        uploadsToday,
        uploadsYesterday,
        "vs yesterday"
      ),
      blockedActions: buildKpi(
        "Blocked Actions",
        blockedTotal,
        blockedToday,
        blockedYesterday,
        "vs yesterday"
      ),
      approvalTime: {
        label: "Avg. Approval Time",
        value: formatApprovalTimeKpi(approvalStats.avgResolutionMinutes),
        change: 0,
        changeLabel: "resolved requests",
        trend: "neutral",
      },
      successRate: buildKpi(
        "Pending Approvals",
        approvalStats.pending,
        approvalStats.pending,
        Math.max(approvalStats.pending - approvalStats.decisionsToday, 0),
        "vs start of day"
      ),
    },
    weeklyTrend,
    monthlyTrend,
    departmentPie:
      departmentPie.length > 0
        ? departmentPie
        : [{ label: "No data", value: 1, color: "#71717a" }],
    actionTypePie:
      actionTypePie.length > 0
        ? actionTypePie
        : [{ label: "No data", value: 1, color: "#71717a" }],
    topRiskyUsers: topRiskyUsers.length > 0 ? topRiskyUsers : [emptyUser],
    mostActiveUsers: mostActiveUsers.length > 0 ? mostActiveUsers : [emptyUser],
    departments,
    heatmap,
    recentActivity,
  };
}
