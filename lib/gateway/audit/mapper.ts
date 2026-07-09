import type { ApprovalStatus } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  DB_EVENT_TO_RUNTIME,
  type GatewayAuditDbEventType,
  type RuntimeAuditEventName,
} from "./runtime-events";

export type RuntimeAuditEventRow = {
  id: string;
  organization_id: string;
  action_proposal_id: string | null;
  event_type: GatewayAuditDbEventType;
  actor_id: string | null;
  agent_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  users?: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
};

const RUNTIME_EVENT_TITLES: Record<RuntimeAuditEventName, string> = {
  "proposal.created": "Proposal Created",
  "policy.allow": "Policy Allowed",
  "policy.review": "Review Required",
  "policy.block": "Policy Blocked",
  "ai.risk_analyzed": "AI Risk Analyzed",
  "ai.risk_failed": "AI Risk Analysis Failed",
  "approval.approved": "Approval Granted",
  "approval.rejected": "Approval Rejected",
  "token.issued": "Execution Token Issued",
  "token.verified": "Execution Token Verified",
  "token.consumed": "Execution Token Consumed",
  "execution.denied": "Execution Denied",
  "proposal.expired": "Proposal Expired",
};

function normalizeUser(
  users: RuntimeAuditEventRow["users"]
): { email: string; full_name: string | null } | null {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

function resolveRuntimeEventName(row: RuntimeAuditEventRow): RuntimeAuditEventName | null {
  const metaEvent = row.metadata?.event;
  if (typeof metaEvent === "string" && metaEvent in RUNTIME_EVENT_TITLES) {
    return metaEvent as RuntimeAuditEventName;
  }
  return DB_EVENT_TO_RUNTIME[row.event_type] ?? null;
}

function runtimeEventToAuditAction(event: RuntimeAuditEventName): AuditTimelineEntry["action"] {
  if (event.startsWith("approval.")) {
    return event === "approval.approved" ? "approve" : "reject";
  }
  if (event.startsWith("policy.block") || event === "execution.denied") {
    return "reject";
  }
  if (event.startsWith("token.") || event.startsWith("proposal.")) {
    return "create";
  }
  if (event.startsWith("ai.")) {
    return "analyze";
  }
  return "update";
}

function runtimeEventToApprovalStatus(
  event: RuntimeAuditEventName
): ApprovalStatus | null {
  if (event === "approval.approved" || event === "policy.allow") return "approved";
  if (event === "approval.rejected" || event === "policy.block") return "rejected";
  if (event === "policy.review") return "pending";
  return null;
}

function buildDescription(row: RuntimeAuditEventRow, event: RuntimeAuditEventName): string {
  const meta = row.metadata ?? {};
  if (typeof meta.description === "string" && meta.description) {
    return meta.description;
  }

  const toolName = typeof meta.toolName === "string" ? meta.toolName : null;
  const actionType = typeof meta.actionType === "string" ? meta.actionType : null;
  const agentId = row.agent_id ?? (typeof meta.agentId === "string" ? meta.agentId : null);
  const reason = typeof meta.reason === "string" ? meta.reason : null;

  const parts: string[] = [];
  if (toolName) parts.push(toolName);
  if (actionType) parts.push(actionType);
  if (agentId) parts.push(`agent ${agentId}`);
  if (reason) parts.push(reason);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return RUNTIME_EVENT_TITLES[event];
}

export function mapRuntimeAuditRowToTimelineEntry(
  row: RuntimeAuditEventRow
): AuditTimelineEntry | null {
  const runtimeEvent = resolveRuntimeEventName(row);
  if (!runtimeEvent) {
    return null;
  }

  const user = normalizeUser(row.users);
  const actor =
    user?.full_name?.trim() ||
    user?.email ||
    row.agent_id ||
    "Gateway";

  const riskLevel = row.metadata?.riskLevel;
  const risk =
    typeof riskLevel === "string" ? (riskLevel as RiskSeverity) : null;

  return {
    id: row.id,
    action: runtimeEventToAuditAction(runtimeEvent),
    title: RUNTIME_EVENT_TITLES[runtimeEvent],
    description: buildDescription(row, runtimeEvent),
    timestamp: row.created_at,
    actor,
    actorEmail: user?.email ?? null,
    risk,
    approvalStatus: runtimeEventToApprovalStatus(runtimeEvent),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    entityType: "action_proposal",
    entityId: row.action_proposal_id,
    metadata: {
      ...(row.metadata ?? {}),
      runtimeEvent,
      source: "gateway",
    },
    runtimeEvent,
    proposalId: row.action_proposal_id,
    source: "runtime",
  };
}

export { RUNTIME_EVENT_TITLES };
