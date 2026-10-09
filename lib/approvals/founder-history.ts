import type { AuditTimelineEntry } from "@/lib/audit/types";
import { formatRelativeTime } from "@/lib/audit/activity-copy";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

export type ApprovalHistoryDecision = "Approved" | "Rejected" | "Expired";

export interface ApprovalHistoryItem {
  id: string;
  action: string;
  agent: string;
  decision: ApprovalHistoryDecision;
  reviewer: string;
  date: string;
  dateLabel: string;
}

const HISTORY_EVENTS = new Set([
  "approval.approved",
  "approval.rejected",
  "review.auto_denied",
  "review.expired",
]);

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

function describeHistoryAction(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  const toolName = typeof meta.toolName === "string" ? meta.toolName.toLowerCase() : "";
  const actionType = typeof meta.actionType === "string" ? meta.actionType.toLowerCase() : "";
  const amount = formatMoney(meta.amount, meta.currency);

  if (toolName.includes("refund") || actionType.includes("refund")) {
    return amount ? `Refund ${amount}` : "Refund";
  }

  if (toolName.includes("delete") || actionType.includes("delete")) {
    return "Delete production data";
  }

  if (toolName.includes("export") || actionType.includes("export")) {
    return "Export customer data";
  }

  if (entry.description?.trim()) {
    return entry.description.trim();
  }

  if (entry.title?.trim()) {
    return entry.title.trim();
  }

  return "Agent action";
}

function decisionForEntry(entry: AuditTimelineEntry): ApprovalHistoryDecision | null {
  const event = entry.runtimeEvent ?? "";

  if (event === "approval.approved" || entry.action === "approve") {
    return "Approved";
  }

  if (event === "approval.rejected" || entry.action === "reject") {
    return "Rejected";
  }

  if (event === "review.auto_denied" || event === "review.expired") {
    return "Expired";
  }

  return null;
}

function reviewerForEntry(entry: AuditTimelineEntry): string {
  if (entry.actorEmail?.trim()) {
    return entry.actorEmail.trim();
  }

  if (entry.actor && entry.actor !== "Gateway" && entry.actor !== "Policy Engine") {
    return entry.actor;
  }

  const meta = entry.metadata ?? {};
  const reviewerEmail =
    typeof meta.reviewerEmail === "string" ? meta.reviewerEmail.trim() : null;
  if (reviewerEmail) {
    return reviewerEmail;
  }

  if (entry.runtimeEvent === "review.auto_denied" || entry.runtimeEvent === "review.expired") {
    return "Wave (deadline expired)";
  }

  return "Reviewer";
}

function agentForEntry(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  const agentId =
    (typeof meta.agentId === "string" ? meta.agentId : null) ??
    (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null);
  return humanizeAgentLabel(agentId ?? "AI Agent");
}

function isHistoryEntry(entry: AuditTimelineEntry): boolean {
  const event = entry.runtimeEvent ?? "";
  if (HISTORY_EVENTS.has(event)) {
    return true;
  }

  return (
    (entry.action === "approve" || entry.action === "reject") &&
    entry.entityType === "action_proposal"
  );
}

export function buildApprovalHistoryFromAudit(
  entries: AuditTimelineEntry[]
): ApprovalHistoryItem[] {
  const items: ApprovalHistoryItem[] = [];

  for (const entry of entries) {
    if (!isHistoryEntry(entry)) {
      continue;
    }

    const decision = decisionForEntry(entry);
    if (!decision) {
      continue;
    }

    items.push({
      id: entry.id,
      action: describeHistoryAction(entry),
      agent: agentForEntry(entry),
      decision,
      reviewer: reviewerForEntry(entry),
      date: entry.timestamp,
      dateLabel: formatRelativeTime(entry.timestamp),
    });
  }

  return items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
