import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

export type AgentConnectionStatus = "Protected" | "Needs attention" | "Not connected";

export type AgentCardSource = "demo" | "zelta" | "connected";

export type AgentDisplayStatus = AgentConnectionStatus | "sandbox";

export interface FounderAgentCard {
  id: string;
  name: string;
  description: string;
  source: AgentCardSource;
  sourceLabel: "Created with Wave" | "Connected" | "Sample agent" | string;
  status: AgentDisplayStatus;
  actionsChecked: number;
  blockedActions: number;
  pendingApprovals: number;
}

export function isDemoAgent(
  agent: Pick<FounderAgentCard, "source" | "status">
): boolean {
  return agent.source === "demo" || agent.status === "sandbox";
}

export interface ProtectionTodayCounts {
  allowed: number;
  needsApproval: number;
  blocked: number;
}

export interface SafetySummaryCounts {
  actionsChecked: number;
  riskyDetected: number;
  actionsBlocked: number;
  approvalsWaiting: number;
}

export interface FounderAttentionItem {
  id: string;
  headline: string;
  reason: string;
  agentName: string;
}

export interface FounderActivityItem {
  id: string;
  tone: "success" | "warning" | "danger" | "neutral";
  message: string;
  timestamp: string;
  /** Shown only in Advanced Details */
  technicalDetail?: string;
}

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getFirstName(
  fullName?: string | null,
  email?: string | null
): string | null {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/)[0] ?? null;
  }
  if (email?.includes("@")) {
    const local = email.split("@")[0] ?? "";
    const segment = local.split(/[._-]/)[0];
    if (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  }
  return null;
}

export function humanizeAgentLabel(agentId: string, name?: string | null): string {
  if (name?.trim() && name.trim() !== agentId) {
    return name.trim();
  }
  return agentId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const GENERIC_KEY_NAMES = new Set([
  "default key",
  "local demo agent",
  "demo agent",
  "production key",
  "api key",
]);

export function describeAgentPurpose(
  agentId: string,
  keyName?: string | null,
  sampleApproval?: PendingApproval
): string {
  const normalizedKeyName = keyName?.trim();
  if (
    normalizedKeyName &&
    normalizedKeyName !== agentId &&
    !GENERIC_KEY_NAMES.has(normalizedKeyName.toLowerCase())
  ) {
    return normalizedKeyName.endsWith(".")
      ? normalizedKeyName
      : `${normalizedKeyName}.`;
  }

  const id = agentId.toLowerCase();
  if (id.includes("support") || id.includes("customer")) {
    return "Handles customer questions and refund requests.";
  }
  if (id.includes("refund")) {
    return "Processes customer refunds and billing adjustments.";
  }
  if (id.includes("sales")) {
    return "Helps with outreach, quotes, and follow-ups.";
  }
  if (id.includes("ops") || id.includes("operation")) {
    return "Runs operational tasks across your business tools.";
  }

  if (sampleApproval?.aiExplanation?.trim()) {
    const sentence = sampleApproval.aiExplanation.split(/[.!?]/)[0]?.trim();
    if (sentence && sentence.length < 120) {
      return `${sentence}.`;
    }
  }

  return "An AI agent connected to Wave for protected actions.";
}

function inferAgentSource(key: AgentApiKeyRecord): "Created with Wave" | "Connected" {
  const normalized = key.name?.trim().toLowerCase() ?? "";
  if (
    !normalized ||
    GENERIC_KEY_NAMES.has(normalized) ||
    normalized.includes("connect") ||
    normalized.includes("integration") ||
    normalized === key.agentId.toLowerCase()
  ) {
    return "Connected";
  }
  return "Created with Wave";
}

function isDemoAgentKey(key: AgentApiKeyRecord): boolean {
  const agentId = key.agentId.toLowerCase();
  const name = (key.name ?? "").toLowerCase();
  return (
    agentId.includes("demo") ||
    name.includes("demo") ||
    name === "local demo agent" ||
    name === "sample agent"
  );
}

export function formatProtectionStatus(status: AgentConnectionStatus): string {
  switch (status) {
    case "Protected":
      return "🟢 Protected";
    case "Needs attention":
      return "🟡 Needs attention";
    default:
      return "⚪ Not connected yet";
  }
}

function formatMoney(amount: unknown, currency?: unknown): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  const code = typeof currency === "string" ? currency.toUpperCase() : "INR";
  const major =
    code === "INR" && amount >= 100 ? amount / 100 : amount >= 10000 ? amount / 100 : amount;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${code} ${major.toLocaleString()}`;
  }
}

function describeToolAction(toolName?: string, actionType?: string): string {
  const tool = (toolName ?? "").replace(/_/g, " ").trim();
  const action = (actionType ?? "").split(".").pop()?.replace(/_/g, " ") ?? "perform an action";

  if (tool) {
    return `${action} via ${tool}`;
  }
  return action;
}

export function describeApprovalHeadline(approval: PendingApproval): string {
  const agentName = humanizeAgentLabel(approval.agentId);
  const payload = approval.actionPayload ?? {};
  const tool = (approval.toolName ?? "").toLowerCase();
  const action = (approval.actionType ?? "").toLowerCase();

  if (tool.includes("refund") || action.includes("refund")) {
    const amount = formatMoney(payload.amount, payload.currency);
    if (amount) {
      return `${agentName} wants to issue a ${amount} refund`;
    }
    return `${agentName} wants to issue a refund`;
  }

  if (tool.includes("delete") || action.includes("delete")) {
    return `${agentName} wants to delete important data`;
  }

  if (tool.includes("export") || action.includes("export")) {
    return `${agentName} wants to export customer data`;
  }

  if (tool.includes("email") || action.includes("email") || action.includes("notify")) {
    return `${agentName} wants to send an email to a customer`;
  }

  if (approval.title && !approval.title.includes("—")) {
    return `${agentName} wants to ${approval.title.toLowerCase()}`;
  }

  return `${agentName} wants to ${describeToolAction(approval.toolName, approval.actionType)}`;
}

export function describeApprovalReason(approval: PendingApproval): string {
  const reviewPolicy = approval.matchedPolicies?.find(
    (policy) => policy.decision === "REVIEW" || policy.decision === "BLOCK"
  );

  if (reviewPolicy?.reason?.trim()) {
    return reviewPolicy.reason.trim();
  }

  if (reviewPolicy?.name?.trim()) {
    return `${reviewPolicy.name}.`;
  }

  const payload = approval.actionPayload ?? {};
  const amount = formatMoney(payload.amount, payload.currency);
  if (amount && (approval.toolName ?? "").includes("refund")) {
    return `This amount is above your automatic refund limit for unattended approvals.`;
  }

  if (approval.aiExplanation?.trim()) {
    return approval.aiExplanation.trim();
  }

  if (approval.businessJustification?.trim()) {
    return approval.businessJustification.trim();
  }

  return "This action needs a human decision before it can continue.";
}

function isToday(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function computeProtectionToday(
  auditEntries: AuditTimelineEntry[],
  pendingApprovals: number,
  now = new Date()
): ProtectionTodayCounts {
  const todayEntries = auditEntries.filter((entry) => isToday(entry.timestamp, now));

  let allowed = 0;
  let blocked = 0;

  for (const entry of todayEntries) {
    const event = entry.runtimeEvent ?? "";
    if (
      event === "policy.allow" ||
      event === "approval.approved" ||
      event === "token.consumed" ||
      event === "token.verified"
    ) {
      allowed += 1;
      continue;
    }
    if (
      event === "policy.block" ||
      event === "approval.rejected" ||
      event === "execution.denied" ||
      event === "review.auto_denied"
    ) {
      blocked += 1;
    }
  }

  return {
    allowed,
    needsApproval: pendingApprovals,
    blocked,
  };
}

export function computeSafetySummary(
  auditEntries: AuditTimelineEntry[],
  pendingApprovals: number,
  now = new Date()
): SafetySummaryCounts {
  const todayEntries = auditEntries.filter((entry) => isToday(entry.timestamp, now));

  let actionsChecked = 0;
  let riskyDetected = 0;
  let actionsBlocked = 0;

  for (const entry of todayEntries) {
    const event = entry.runtimeEvent ?? "";

    if (
      event === "proposal.created" ||
      event.startsWith("policy.") ||
      event === "decision.composed"
    ) {
      actionsChecked += 1;
    }
    if (event === "policy.review") {
      riskyDetected += 1;
    }
    if (
      event === "policy.block" ||
      event === "approval.rejected" ||
      event === "execution.denied" ||
      event === "review.auto_denied"
    ) {
      actionsBlocked += 1;
    }
  }

  return {
    actionsChecked,
    riskyDetected,
    actionsBlocked,
    approvalsWaiting: pendingApprovals,
  };
}

export function buildAgentCards(
  keys: AgentApiKeyRecord[],
  approvals: PendingApproval[],
  auditEntries: AuditTimelineEntry[]
): FounderAgentCard[] {
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const byAgent = new Map<string, AgentApiKeyRecord>();

  for (const key of activeKeys) {
    const existing = byAgent.get(key.agentId);
    if (
      !existing ||
      (key.lastUsedAt &&
        (!existing.lastUsedAt || key.lastUsedAt > existing.lastUsedAt))
    ) {
      byAgent.set(key.agentId, key);
    }
  }

  const pendingByAgent = approvals.reduce<Record<string, number>>((acc, item) => {
    acc[item.agentId] = (acc[item.agentId] ?? 0) + 1;
    return acc;
  }, {});

  const allTimeByAgent = auditEntries.reduce<
    Record<string, { actions: number; blocked: number }>
  >((acc, entry) => {
    const agentId =
      (typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null) ??
      entry.actor;
    if (!agentId || agentId === "Gateway") return acc;

    const bucket = acc[agentId] ?? { actions: 0, blocked: 0 };
    bucket.actions += 1;

    const event = entry.runtimeEvent ?? "";
    if (
      event === "policy.block" ||
      event === "approval.rejected" ||
      event === "execution.denied" ||
      event === "review.auto_denied"
    ) {
      bucket.blocked += 1;
    }

    acc[agentId] = bucket;
    return acc;
  }, {});

  return Array.from(byAgent.values()).map((key) => {
    const pending = pendingByAgent[key.agentId] ?? 0;
    const totals = allTimeByAgent[key.agentId] ?? { actions: 0, blocked: 0 };
    const sampleApproval = approvals.find((item) => item.agentId === key.agentId);
    const demo = isDemoAgentKey(key);

    let status: AgentDisplayStatus = "Protected";
    if (demo) {
      status = "sandbox";
    } else if (pending > 0) {
      status = "Needs attention";
    } else if (!key.lastUsedAt) {
      status = "Not connected";
    }

    const inferred = inferAgentSource(key);

    return {
      id: key.agentId,
      name: humanizeAgentLabel(key.agentId, key.name),
      description: describeAgentPurpose(key.agentId, key.name, sampleApproval),
      source: demo ? "demo" : inferred === "Created with Wave" ? "zelta" : "connected",
      sourceLabel: demo ? "Sample agent" : inferred,
      status,
      actionsChecked: totals.actions,
      blockedActions: totals.blocked,
      pendingApprovals: pending,
    };
  });
}

export function buildAttentionItems(approvals: PendingApproval[]): FounderAttentionItem[] {
  return approvals.slice(0, 5).map((approval) => ({
    id: approval.id,
    headline: describeApprovalHeadline(approval),
    reason: describeApprovalReason(approval),
    agentName: humanizeAgentLabel(approval.agentId),
  }));
}

export function formatActivityMessage(entry: AuditTimelineEntry): FounderActivityItem {
  const event = entry.runtimeEvent ?? "";
  const meta = entry.metadata ?? {};
  const toolName = typeof meta.toolName === "string" ? meta.toolName : null;
  const amount = formatMoney(meta.amount, meta.currency);

  let tone: FounderActivityItem["tone"] = "neutral";
  let message = entry.description || entry.title;

  if (event === "policy.allow" || event === "approval.approved") {
    tone = "success";
    if (toolName?.includes("refund") && amount) {
      message = `Refund of ${amount} approved automatically`;
    } else if (toolName?.includes("email")) {
      message = "Email sent to customer";
    } else {
      message = entry.description || "Action approved and allowed";
    }
  } else if (event === "policy.review") {
    tone = "warning";
    if (toolName?.includes("refund") && amount) {
      message = `Refund of ${amount} waiting for approval`;
    } else {
      message = entry.description || "An action is waiting for your approval";
    }
  } else if (
    event === "policy.block" ||
    event === "execution.denied" ||
    event === "approval.rejected" ||
    event === "review.auto_denied"
  ) {
    tone = "danger";
    if (toolName?.includes("delete")) {
      message = "Attempt to delete important data blocked";
    } else {
      message = entry.description || "A risky action was blocked";
    }
  } else if (event === "token.consumed" || event === "token.verified") {
    tone = "success";
    message = "Approved action completed successfully";
  } else if (entry.action === "approve") {
    tone = "success";
    message = entry.description || "You approved an agent action";
  } else if (entry.action === "reject") {
    tone = "danger";
    message = entry.description || "You rejected an agent action";
  }

  const technicalParts = [
    entry.runtimeEvent,
    entry.proposalId ? `Reference ${entry.proposalId.slice(0, 8)}…` : null,
  ].filter(Boolean);

  return {
    id: entry.id,
    tone,
    message,
    timestamp: entry.timestamp,
    technicalDetail: technicalParts.length > 0 ? technicalParts.join(" · ") : undefined,
  };
}

export function buildRecentActivity(
  auditEntries: AuditTimelineEntry[],
  limit = 8
): FounderActivityItem[] {
  const meaningful = auditEntries.filter((entry) => {
    if (entry.source === "runtime" && !entry.runtimeEvent) {
      return false;
    }
    return true;
  });

  return meaningful.slice(0, limit).map(formatActivityMessage);
}
