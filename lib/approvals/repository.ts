import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalPriority,
  ApprovalStatus,
  HistoryEntry,
  PendingApproval,
  TimelineEvent,
} from "@/lib/approval-types";
import type { DetectedRisk } from "@/lib/risk-types";
import { ApprovalEngineError } from "./errors";

type ApprovalRequestRow = {
  id: string;
  organization_id: string;
  risk_analysis_id: string | null;
  requester_id: string;
  assignee_id: string | null;
  title: string;
  agent_id: string;
  risk_severity: PendingApproval["riskSeverity"];
  priority: ApprovalPriority;
  status: ApprovalStatus;
  ai_explanation: string;
  business_justification: string;
  affected_systems: string[];
  affected_users: string[];
  compliance_impact: string;
  recommended_action: string;
  confidence_score: number;
  timeline: TimelineEvent[];
  required_approvals: number;
  approvals_received: number;
  sla_deadline: string;
  submitted_at: string;
  resolved_at: string | null;
  created_at: string;
};

type HistoryRow = {
  id: string;
  approval_request_id: string;
  actor_id: string;
  action: string;
  note: string | null;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function displayName(user: UserRow | null | undefined, fallback = "User"): string {
  if (!user) return fallback;
  return user.full_name?.trim() || user.email || fallback;
}

function extractAgentId(sourceLog: string): string {
  const match = sourceLog.match(/agent[-_]?(\d+)/i);
  if (match) return `agent-${match[1]}`;
  return "unknown-agent";
}

function buildTimelineForRisk(
  risk: DetectedRisk,
  ruleLabel: string,
  submittedAt: string
): TimelineEvent[] {
  return [
    {
      id: `tl-${risk.id}-created`,
      title: "Approval Request Created",
      description: ruleLabel,
      timestamp: submittedAt,
      actor: "Approval Engine",
      type: "created",
    },
    {
      id: `tl-${risk.id}-analyzed`,
      title: "Risk Classified",
      description: `${risk.severity} — ${risk.title}`,
      timestamp: risk.detectedAt,
      actor: "Risk Classifier",
      type: "analyzed",
    },
    {
      id: `tl-${risk.id}-assigned`,
      title: "Routed for Review",
      description: "Awaiting human authorization per policy tier",
      timestamp: submittedAt,
      actor: "Approval Engine",
      type: "assigned",
    },
  ];
}

function mapHistoryRow(row: HistoryRow, actorName: string): HistoryEntry {
  return {
    id: row.id,
    action: row.action,
    actor: actorName,
    timestamp: row.created_at,
    note: row.note ?? undefined,
  };
}

export async function fetchUserMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, UserRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name")
    .in("id", unique);

  if (error) {
    throw new ApprovalEngineError(error.message);
  }

  return new Map(((data ?? []) as UserRow[]).map((user) => [user.id, user]));
}

export async function listPendingApprovals(
  supabase: SupabaseClient
): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new ApprovalEngineError(error.message);
  }

  const rows = (data ?? []) as ApprovalRequestRow[];
  if (rows.length === 0) return [];

  const userIds = rows.flatMap((row) => [row.requester_id, row.assignee_id ?? ""]);
  const users = await fetchUserMap(supabase, userIds);

  const historyByRequest = await fetchHistoryForRequests(
    supabase,
    rows.map((row) => row.id)
  );

  return rows.map((row) =>
    mapApprovalRequestRow(row, users, historyByRequest.get(row.id) ?? [])
  );
}

async function fetchHistoryForRequests(
  supabase: SupabaseClient,
  requestIds: string[]
): Promise<Map<string, HistoryEntry[]>> {
  if (requestIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("approval_history")
    .select("id, approval_request_id, actor_id, action, note, created_at")
    .in("approval_request_id", requestIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApprovalEngineError(error.message);
  }

  const rows = (data ?? []) as HistoryRow[];
  const actorIds = rows.map((row) => row.actor_id);
  const users = await fetchUserMap(supabase, actorIds);

  const grouped = new Map<string, HistoryEntry[]>();

  for (const row of rows) {
    const actorName =
      row.action === "auto_approved"
        ? "Approval Engine"
        : displayName(users.get(row.actor_id), "Reviewer");

    const entry = mapHistoryRow(row, actorName);
    const list = grouped.get(row.approval_request_id) ?? [];
    list.push(entry);
    grouped.set(row.approval_request_id, list);
  }

  return grouped;
}

export function mapApprovalRequestRow(
  row: ApprovalRequestRow,
  users: Map<string, UserRow>,
  history: HistoryEntry[]
): PendingApproval {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agent_id,
    riskSeverity: row.risk_severity,
    priority: row.priority,
    aiExplanation: row.ai_explanation,
    businessJustification: row.business_justification,
    affectedSystems: row.affected_systems ?? [],
    affectedUsers: row.affected_users ?? [],
    complianceImpact: row.compliance_impact,
    recommendedAction: row.recommended_action,
    confidenceScore: row.confidence_score,
    timeline: (row.timeline as TimelineEvent[]) ?? [],
    history,
    submittedAt: row.submitted_at,
    slaDeadline: row.sla_deadline,
    assignee: row.assignee_id
      ? displayName(users.get(row.assignee_id), "Unassigned")
      : "Unassigned",
    requester: displayName(users.get(row.requester_id), "System"),
  };
}

export async function getApprovalRequest(
  supabase: SupabaseClient,
  requestId: string
): Promise<ApprovalRequestRow | null> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new ApprovalEngineError(error.message);
  }

  return (data as ApprovalRequestRow | null) ?? null;
}

export async function insertApprovalHistory(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    approvalRequestId: string;
    actorId: string;
    action: string;
    note?: string | null;
  }
): Promise<HistoryRow> {
  const { data, error } = await supabase
    .from("approval_history")
    .insert({
      organization_id: params.organizationId,
      approval_request_id: params.approvalRequestId,
      actor_id: params.actorId,
      action: params.action,
      note: params.note ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApprovalEngineError(error?.message ?? "Failed to record approval decision.");
  }

  return data as HistoryRow;
}

export async function createApprovalFromRisk(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    requesterId: string;
    riskAnalysisId: string;
    risk: DetectedRisk;
    requiredApprovals: number;
    autoApprove: boolean;
    ruleLabel: string;
    priority: ApprovalPriority;
    slaDeadline: string;
    submittedAt: string;
  }
): Promise<ApprovalRequestRow> {
  const { risk } = params;

  const affectedSystems = [
    risk.mitreAttack?.technique &&
      `${risk.mitreAttack.technique} (${risk.mitreAttack.techniqueId})`,
    risk.owaspCategory,
  ].filter(Boolean) as string[];

  if (affectedSystems.length === 0) {
    affectedSystems.push(risk.sourceLog || "Unknown system");
  }

  const affectedUsers =
    risk.relatedEvents?.map((event) => event.title).slice(0, 5) ??
    ["Affected users per risk analysis"];

  const timeline = buildTimelineForRisk(params.risk, params.ruleLabel, params.submittedAt);

  const status: ApprovalStatus = params.autoApprove ? "approved" : "pending";
  const resolvedAt = params.autoApprove ? params.submittedAt : null;
  const approvalsReceived = params.autoApprove ? 0 : 0;

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      organization_id: params.organizationId,
      risk_analysis_id: params.riskAnalysisId,
      requester_id: params.requesterId,
      assignee_id: null,
      title: params.risk.title,
      agent_id: extractAgentId(params.risk.sourceLog),
      risk_severity: params.risk.severity,
      priority: params.priority,
      status,
      ai_explanation: params.risk.explanation,
      business_justification: params.risk.businessImpact,
      affected_systems: affectedSystems,
      affected_users: affectedUsers,
      compliance_impact: params.risk.complianceImpact,
      recommended_action: params.risk.suggestedAction,
      confidence_score: params.risk.confidence,
      timeline,
      required_approvals: params.requiredApprovals,
      approvals_received: approvalsReceived,
      sla_deadline: params.slaDeadline,
      submitted_at: params.submittedAt,
      resolved_at: resolvedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new ApprovalEngineError(error?.message ?? "Failed to create approval request.");
  }

  const row = data as ApprovalRequestRow;

  await insertApprovalHistory(supabase, {
    organizationId: params.organizationId,
    approvalRequestId: row.id,
    actorId: params.requesterId,
    action: "approval_request_created",
    note: params.ruleLabel,
  });

  if (params.autoApprove) {
    await insertApprovalHistory(supabase, {
      organizationId: params.organizationId,
      approvalRequestId: row.id,
      actorId: params.requesterId,
      action: "auto_approved",
      note: "Safe tier — no human approval required",
    });
  }

  return row;
}

export async function updateApprovalRequest(
  supabase: SupabaseClient,
  requestId: string,
  patch: Partial<{
    status: ApprovalStatus;
    approvals_received: number;
    resolved_at: string | null;
    timeline: TimelineEvent[];
    priority: ApprovalPriority;
  }>
): Promise<ApprovalRequestRow> {
  const { data, error } = await supabase
    .from("approval_requests")
    .update(patch)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error || !data) {
    throw new ApprovalEngineError(error?.message ?? "Failed to update approval request.");
  }

  return data as ApprovalRequestRow;
}

export async function countApprovalDecisions(
  supabase: SupabaseClient,
  approvalRequestId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("approval_history")
    .select("id", { count: "exact", head: true })
    .eq("approval_request_id", approvalRequestId)
    .eq("action", "approved");

  if (error) {
    throw new ApprovalEngineError(error.message);
  }

  return count ?? 0;
}
