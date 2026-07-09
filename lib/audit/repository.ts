import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalStatus } from "@/lib/approval-types";
import type { RiskSeverity } from "@/lib/risk-types";
import { mapRuntimeAuditRowToTimelineEntry } from "@/lib/gateway/audit/mapper";
import { AuditLogError } from "./errors";
import type { AuditAction, AuditLogInput, AuditTimelineEntry, AuditTimelinePage } from "./types";

type AuditRow = {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  risk_severity: RiskSeverity | null;
  approval_status: ApprovalStatus | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  users: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
};

const TIMELINE_SELECT =
  "id, action, entity_type, entity_id, metadata, risk_severity, approval_status, ip_address, user_agent, created_at, users(email, full_name)";

function normalizeUser(
  users: AuditRow["users"]
): { email: string; full_name: string | null } | null {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

function actionTitle(action: AuditAction): string {
  const titles: Record<AuditAction, string> = {
    create: "Record Created",
    update: "Record Updated",
    delete: "Record Deleted",
    login: "User Signed In",
    logout: "User Signed Out",
    approve: "Approval Granted",
    reject: "Approval Rejected",
    escalate: "Approval Escalated",
    upload: "Log Uploaded",
    translate: "Log Translated",
    analyze: "Risk Analyzed",
    notify: "Notification Sent",
    subscribe: "Subscription Updated",
  };
  return titles[action] ?? "Action Recorded";
}

function buildDescription(row: AuditRow): string {
  const meta = row.metadata ?? {};
  if (typeof meta.description === "string" && meta.description) {
    return meta.description;
  }
  if (typeof meta.title === "string" && meta.title) {
    return meta.title;
  }
  if (row.entity_type && row.entity_id) {
    return `${row.entity_type} · ${row.entity_id}`;
  }
  return actionTitle(row.action);
}

export function mapAuditRowToTimelineEntry(row: AuditRow): AuditTimelineEntry {
  const user = normalizeUser(row.users);
  const actor = user?.full_name?.trim() || user?.email || "System";

  return {
    id: row.id,
    action: row.action,
    title: actionTitle(row.action),
    description: buildDescription(row),
    timestamp: row.created_at,
    actor,
    actorEmail: user?.email ?? null,
    risk: row.risk_severity,
    approvalStatus: row.approval_status,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    source: "retrospective",
  };
}

export async function insertAuditLog(
  supabase: SupabaseClient,
  input: AuditLogInput
): Promise<string> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
      risk_severity: input.riskSeverity ?? null,
      approval_status: input.approvalStatus ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AuditLogError(error?.message ?? "Failed to write audit log.");
  }

  return data.id as string;
}

export interface TimelineQueryOptions {
  organizationId?: string | null;
  limit?: number;
  cursor?: string | null;
  action?: AuditAction | null;
}

const RUNTIME_TIMELINE_SELECT =
  "id, organization_id, action_proposal_id, event_type, actor_id, agent_id, metadata, ip_address, user_agent, created_at, users(email, full_name)";

async function fetchRetrospectiveTimelineEntries(
  supabase: SupabaseClient,
  options: TimelineQueryOptions,
  fetchLimit: number
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("audit_logs")
    .select(TIMELINE_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(fetchLimit);

  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  if (options.action) {
    query = query.eq("action", options.action);
  }

  if (options.cursor) {
    const cursorTime = decodeCursor(options.cursor);
    if (cursorTime) {
      query = query.lt("created_at", cursorTime);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new AuditLogError(error.message);
  }

  return ((data ?? []) as unknown as AuditRow[]).map(mapAuditRowToTimelineEntry);
}

async function fetchRuntimeTimelineEntries(
  supabase: SupabaseClient,
  options: TimelineQueryOptions,
  fetchLimit: number
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("audit_events")
    .select(RUNTIME_TIMELINE_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(fetchLimit);

  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  if (options.cursor) {
    const cursorTime = decodeCursor(options.cursor);
    if (cursorTime) {
      query = query.lt("created_at", cursorTime);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new AuditLogError(error.message);
  }

  const entries = ((data ?? []) as Parameters<typeof mapRuntimeAuditRowToTimelineEntry>[0][])
    .map(mapRuntimeAuditRowToTimelineEntry)
    .filter((entry): entry is AuditTimelineEntry => entry !== null);

  if (options.action) {
    return entries.filter((entry) => entry.action === options.action);
  }

  return entries;
}

function mergeTimelineEntries(
  retrospective: AuditTimelineEntry[],
  runtime: AuditTimelineEntry[]
): AuditTimelineEntry[] {
  return [...retrospective, ...runtime].sort((a, b) => {
    const timeDiff = b.timestamp.localeCompare(a.timestamp);
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
}

/**
 * Cursor-paginated audit timeline merging retrospective audit_logs and runtime audit_events.
 */
export async function fetchAuditTimeline(
  supabase: SupabaseClient,
  options: TimelineQueryOptions = {}
): Promise<AuditTimelinePage> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const fetchLimit = limit + 1;

  const [retrospective, runtime] = await Promise.all([
    fetchRetrospectiveTimelineEntries(supabase, options, fetchLimit),
    fetchRuntimeTimelineEntries(supabase, options, fetchLimit),
  ]);

  const merged = mergeTimelineEntries(retrospective, runtime);
  const hasMore = merged.length > limit;
  const pageEntries = hasMore ? merged.slice(0, limit) : merged;
  const last = pageEntries[pageEntries.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.timestamp) : null;

  return { entries: pageEntries, nextCursor, hasMore };
}

function encodeCursor(createdAt: string): string {
  return Buffer.from(createdAt).toString("base64url");
}

function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
