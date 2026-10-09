import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { FounderActivityView } from "@/lib/audit/activity-copy";
import {
  buildFounderActivityView,
} from "@/lib/audit/activity-copy";
import { buildDemoActivityViews } from "@/lib/audit/demo-activity-events";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

export type AgentActionType =
  | "action_proposed"
  | "action_approved"
  | "action_rejected"
  | "action_executed"
  | "action_blocked";

export type AgentActionStatus = "executed" | "pending" | "blocked";

export interface AgentActionActivity {
  id: string;
  type: "agent_action";
  actionType: AgentActionType;
  agentId: string;
  agentName: string;
  toolName: string;
  /** e.g. "Refund handler issued_refund" */
  summary: string;
  status: AgentActionStatus;
  statusLabel: string;
  relativeTime: string;
  timestamp: string;
  isSimulated: boolean;
}

const NON_AGENT_AUDIT_ACTIONS = new Set<AuditTimelineEntry["action"]>([
  "upload",
  "translate",
  "analyze",
  "login",
  "logout",
  "subscribe",
  "notify",
  "create",
  "update",
  "delete",
  "escalate",
]);

const AGENT_RUNTIME_EVENTS = new Set([
  "proposal.created",
  "policy.allow",
  "policy.review",
  "policy.block",
  "approval.approved",
  "approval.rejected",
  "execution.denied",
  "review.auto_denied",
  "token.consumed",
  "token.verified",
]);

export function formatCompactRelativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function resolveAgentId(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  return (
    (typeof meta.agentId === "string" ? meta.agentId : null) ??
    (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null) ??
    "ai-agent"
  );
}

function resolveToolName(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  if (typeof meta.toolName === "string" && meta.toolName.trim()) {
    return meta.toolName.trim();
  }
  if (typeof meta.actionType === "string" && meta.actionType.trim()) {
    return meta.actionType.trim();
  }
  return "agent_action";
}

export function classifyAgentActionType(
  entry: AuditTimelineEntry,
  event = entry.runtimeEvent ?? ""
): AgentActionType | null {
  if (event === "proposal.created" || event === "policy.review") {
    return "action_proposed";
  }
  if (event === "approval.approved" || entry.action === "approve") {
    return "action_approved";
  }
  if (
    event === "approval.rejected" ||
    event === "review.auto_denied" ||
    entry.action === "reject"
  ) {
    return "action_rejected";
  }
  if (
    event === "policy.allow" ||
    event === "token.consumed" ||
    event === "token.verified"
  ) {
    return "action_executed";
  }
  if (event === "policy.block" || event === "execution.denied") {
    return "action_blocked";
  }
  return null;
}

function resolveAgentActionStatus(actionType: AgentActionType): {
  status: AgentActionStatus;
  statusLabel: string;
} {
  switch (actionType) {
    case "action_executed":
    case "action_approved":
      return { status: "executed", statusLabel: "Executed" };
    case "action_proposed":
      return { status: "pending", statusLabel: "Pending" };
    case "action_blocked":
    case "action_rejected":
      return { status: "blocked", statusLabel: "Blocked" };
    default:
      return { status: "pending", statusLabel: "Pending" };
  }
}

export function isAgentActionEntry(entry: AuditTimelineEntry): boolean {
  const event = entry.runtimeEvent ?? "";

  if (entry.entityType === "action_proposal") {
    return true;
  }

  if (entry.source === "runtime" && event && AGENT_RUNTIME_EVENTS.has(event)) {
    return true;
  }

  if (entry.action === "approve" || entry.action === "reject") {
    return true;
  }

  if (NON_AGENT_AUDIT_ACTIONS.has(entry.action)) {
    return false;
  }

  return false;
}

export function buildAgentActionFromEntry(
  entry: AuditTimelineEntry,
  now = Date.now()
): AgentActionActivity | null {
  if (!isAgentActionEntry(entry)) {
    return null;
  }

  const event = entry.runtimeEvent ?? "";
  const actionType = classifyAgentActionType(entry, event);
  if (!actionType) {
    return null;
  }

  const agentId = resolveAgentId(entry);
  const agentName = humanizeAgentLabel(agentId, entry.metadata?.agentName as string | undefined);
  const toolName = resolveToolName(entry);
  const { status, statusLabel } = resolveAgentActionStatus(actionType);

  return {
    id: entry.id,
    type: "agent_action",
    actionType,
    agentId,
    agentName,
    toolName,
    summary: `${agentName} ${toolName}`,
    status,
    statusLabel,
    relativeTime: formatCompactRelativeTime(entry.timestamp, now),
    timestamp: entry.timestamp,
    isSimulated: false,
  };
}

export function buildAgentActionsFromAudit(
  entries: AuditTimelineEntry[],
  limit = 5,
  now = Date.now()
): AgentActionActivity[] {
  return entries
    .map((entry) => buildAgentActionFromEntry(entry, now))
    .filter((entry): entry is AgentActionActivity => entry !== null)
    .slice(0, limit);
}

export function buildAgentActionsFromViews(
  views: FounderActivityView[],
  limit = 5,
  now = Date.now()
): AgentActionActivity[] {
  return views.slice(0, limit).map((view) => {
    const event = view.technical.runtimeEvent ?? "";
    const actionType =
      classifyAgentActionType(
        {
          id: view.id,
          action: "create",
          title: "",
          description: "",
          timestamp: view.timestamp,
          actor: view.agentId,
          actorEmail: null,
          risk: null,
          approvalStatus: null,
          ipAddress: null,
          userAgent: null,
          entityType: view.technical.entityType,
          entityId: view.technical.entityId,
          metadata: view.technical.metadata,
          runtimeEvent: event,
          proposalId: view.technical.proposalId ?? null,
          source: view.technical.source as AuditTimelineEntry["source"],
        },
        event
      ) ?? "action_executed";

    const toolName =
      typeof view.technical.metadata.toolName === "string"
        ? view.technical.metadata.toolName
        : view.actionLabel.replace(/\s+/g, "_").toLowerCase();

    const { status, statusLabel } = resolveAgentActionStatus(actionType);

    return {
      id: view.id,
      type: "agent_action",
      actionType,
      agentId: view.agentId,
      agentName: view.agentName,
      toolName,
      summary: `${view.agentName} ${toolName}`,
      status,
      statusLabel,
      relativeTime: formatCompactRelativeTime(view.timestamp, now),
      timestamp: view.timestamp,
      isSimulated: view.isSimulated,
    };
  });
}

export function buildRecentAgentActions(
  entries: AuditTimelineEntry[],
  options: {
    limit?: number;
    includeDemo?: boolean;
    now?: number;
  } = {}
): AgentActionActivity[] {
  const { limit = 5, includeDemo = false, now = Date.now() } = options;
  const fromAudit = buildAgentActionsFromAudit(entries, limit, now);

  if (fromAudit.length > 0) {
    return fromAudit;
  }

  if (includeDemo) {
    return buildAgentActionsFromViews(buildDemoActivityViews(now), limit, now);
  }

  return [];
}

export function isAgentActionActivity(
  activity: Pick<AgentActionActivity, "type">
): activity is AgentActionActivity {
  return activity.type === "agent_action";
}

export function filterAgentActionViews(views: FounderActivityView[]): FounderActivityView[] {
  return views.filter((view) => {
    if (view.technical.entityType === "action_proposal") {
      return true;
    }
    const event = view.technical.runtimeEvent ?? "";
    return Boolean(event && AGENT_RUNTIME_EVENTS.has(event));
  });
}

export function buildAgentActionViewsFromAudit(
  entries: AuditTimelineEntry[],
  now = Date.now()
): FounderActivityView[] {
  return entries
    .filter(isAgentActionEntry)
    .map((entry) => buildFounderActivityView(entry, now))
    .filter((entry): entry is FounderActivityView => entry !== null);
}
