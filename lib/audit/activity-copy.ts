import type { AuditTimelineEntry } from "@/lib/audit/types";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

export type ActivityFilter = "all" | "allowed" | "review" | "blocked";

export type ActivityTone = "allowed" | "review" | "blocked" | "neutral";

export type ActionTypeFilter = "all" | "refund" | "email" | "delete" | "export" | "other";

export type DateFilter = "all" | "today" | "week" | "month";

export interface ActivityFilters {
  agent: string;
  decision: ActivityFilter;
  actionType: ActionTypeFilter;
  date: DateFilter;
}

export interface ZeltaCheckSummary {
  policy: string;
  risk: string;
  humanReview: string;
}

export interface ActivityDetailView {
  agent: string;
  requestedAction: string;
  time: string;
  timeFull: string;
  policyResult: string;
  riskResult: string;
  finalDecision: string;
  approvalInfo: string | null;
  executionResult: string;
}

export interface FounderActivityView {
  id: string;
  agentId: string;
  agentName: string;
  actionLabel: string;
  actionType: Exclude<ActionTypeFilter, "all">;
  decisionLabel: string;
  message: string;
  reason: string;
  tone: ActivityTone;
  timestamp: string;
  relativeTime: string;
  timeDisplay: string;
  riskLabel: string;
  statusLabel: string;
  proposedAction: string;
  zeltaChecked: ZeltaCheckSummary;
  finalDecisionText: string;
  isSimulated: boolean;
  whatHappened: string;
  whyDecision: string;
  actionTaken: string;
  filterCategory: Exclude<ActivityFilter, "all"> | null;
  details: ActivityDetailView;
  technical: {
    runtimeEvent?: string | null;
    proposalId?: string | null;
    metadata: Record<string, unknown>;
    entityType: string;
    entityId: string | null;
    actor: string;
    actorEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    source?: string;
  };
}

const INTERNAL_RUNTIME_EVENTS = new Set([
  "ai.risk_analyzed",
  "ai.risk_failed",
  "shadow.risk_analyzed",
  "shadow.risk_failed",
  "risk.assessment_started",
  "risk.assessment_completed",
  "risk.assessment_failed",
  "decision.composed",
  "notification.queued",
  "notification.sent",
  "notification.failed",
  "review.deadline_set",
  "review.expired",
  "proposal.created",
  "token.issued",
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

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function resolveAgentId(entry: AuditTimelineEntry): string {
  const meta = entry.metadata ?? {};
  return (
    (typeof meta.agentId === "string" ? meta.agentId : null) ??
    (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null) ??
    "ai-agent"
  );
}

function resolveAgentName(entry: AuditTimelineEntry): string {
  return humanizeAgentLabel(resolveAgentId(entry));
}

function classifyActionType(meta: Record<string, unknown>): Exclude<ActionTypeFilter, "all"> {
  if (includesTool(meta, "refund")) return "refund";
  if (includesTool(meta, "email") || includesTool(meta, "mail")) return "email";
  if (includesTool(meta, "delete")) return "delete";
  if (includesTool(meta, "export")) return "export";
  return "other";
}

function buildActionLabel(
  meta: Record<string, unknown>,
  amount: string | null
): string {
  if (includesTool(meta, "refund")) {
    return amount ? `Refund ${amount}` : "Refund";
  }
  if (includesTool(meta, "email") || includesTool(meta, "mail")) {
    return "Send customer email";
  }
  if (includesTool(meta, "delete")) {
    const target =
      typeof meta.databaseName === "string"
        ? meta.databaseName
        : "production data";
    return `Delete ${target}`;
  }
  if (includesTool(meta, "export")) {
    return "Export customer data";
  }

  const toolName = typeof meta.toolName === "string" ? meta.toolName.replace(/_/g, " ") : null;
  if (toolName) {
    return toolName.charAt(0).toUpperCase() + toolName.slice(1);
  }

  return "Agent action";
}

function formatTimeDisplay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveRiskLabel(entry: AuditTimelineEntry, meta: Record<string, unknown>): string {
  const amount = formatMoney(meta.amount, meta.currency);
  const tool = typeof meta.toolName === "string" ? meta.toolName.toLowerCase() : "";
  const actionType =
    typeof meta.actionType === "string" ? meta.actionType.toLowerCase() : "";

  if ((tool.includes("refund") || actionType.includes("refund")) && amount) {
    const amountRaw = typeof meta.amount === "number" ? meta.amount : null;
    const major =
      amountRaw && String(meta.currency ?? "INR").toUpperCase() === "INR" && amountRaw >= 100
        ? amountRaw / 100
        : amountRaw;

    if (major && major >= 75_000) {
      return "Critical";
    }
    if (major && major > 5_000) {
      return "High";
    }
  }

  const risk = entry.risk ?? (typeof meta.riskLevel === "string" ? meta.riskLevel : null);
  switch (risk) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Low";
  }
}

function buildStatusLabel(tone: ActivityTone, event: string): string {
  if (event === "token.consumed") {
    return "✓ Executed";
  }
  if (tone === "review" || event === "policy.review") {
    return "Waiting";
  }
  if (tone === "blocked" || event === "approval.rejected") {
    return "Blocked";
  }
  if (
    tone === "allowed" ||
    event === "policy.allow" ||
    event === "approval.approved" ||
    event === "token.verified"
  ) {
    return "Completed";
  }
  return "Recorded";
}

function buildProposedAction(
  meta: Record<string, unknown>,
  actionLabel: string,
  amount: string | null
): string {
  const customerId =
    (typeof meta.customerId === "string" && meta.customerId.trim()) ||
    (typeof meta.customer_id === "string" && meta.customer_id.trim()) ||
    null;

  if (includesTool(meta, "refund") && amount && customerId) {
    return `Refund ${amount} to customer ${customerId}`;
  }

  if (includesTool(meta, "refund") && amount) {
    return `Refund ${amount}`;
  }

  if (includesTool(meta, "email") || includesTool(meta, "mail")) {
    return "Send customer email";
  }

  if (includesTool(meta, "delete")) {
    const target =
      typeof meta.databaseName === "string"
        ? meta.databaseName
        : "customer records";
    return `Delete ${target}`;
  }

  return actionLabel;
}

function buildZeltaChecked(
  entry: AuditTimelineEntry,
  event: string,
  tone: ActivityTone,
  riskLabel: string
): ZeltaCheckSummary {
  let policy = "Evaluated against your rules";
  if (event === "policy.allow" || tone === "allowed") {
    policy = "Allowed automatically";
  } else if (event === "policy.review" || tone === "review") {
    policy = "Approval required";
  } else if (event === "policy.block" || tone === "blocked") {
    policy = "Blocked";
  }

  let humanReview = "Not required";
  if (tone === "review" || event === "policy.review") {
    humanReview = "Required";
  } else if (tone === "blocked") {
    humanReview = "Not applicable";
  } else if (event === "approval.approved" || entry.action === "approve") {
    humanReview = "Completed";
  }

  return {
    policy,
    risk: riskLabel,
    humanReview,
  };
}

function buildFinalDecisionText(tone: ActivityTone, event: string): string {
  if (tone === "review" || event === "policy.review") {
    return "Waiting for approval";
  }
  if (tone === "blocked" || event === "policy.block" || event === "execution.denied") {
    return "Blocked by Wave";
  }
  if (event === "approval.approved" || event === "token.consumed") {
    return "Completed after approval";
  }
  if (event === "approval.rejected" || event === "review.auto_denied") {
    return "Rejected — action prevented";
  }
  if (tone === "allowed" || event === "policy.allow") {
    return "Completed automatically";
  }
  return "Recorded in audit trail";
}

function buildDecisionLabel(tone: ActivityTone, event: string, meta: Record<string, unknown> = {}): string {
  if (event === "token.consumed") {
    return meta.source === "dashboard_approval" ? "Approved by you" : "Approved";
  }
  if (event === "approval.rejected") {
    return "Rejected by you";
  }
  if (tone === "allowed" || event === "approval.approved") {
    return "Allow";
  }
  if (tone === "review" || event === "policy.review") {
    return "Approval Required";
  }
  if (tone === "blocked") {
    return "Blocked";
  }
  return "Recorded";
}

function buildListReason(
  entry: AuditTimelineEntry,
  event: string,
  meta: Record<string, unknown>,
  amount: string | null
): string {
  if (event === "policy.review" && includesTool(meta, "refund")) {
    return "Refund exceeds the configured approval limit of ₹5,000.";
  }

  if (event === "policy.review" && includesTool(meta, "export")) {
    return "Export size exceeds the limit that can run without approval.";
  }

  if (event === "policy.allow") {
    return "Action was within your automatic safety limits.";
  }

  if (event === "policy.block" || event === "execution.denied") {
    if (includesTool(meta, "delete")) {
      return "Destructive actions are blocked by your protection rules.";
    }
    return "Action was blocked by your protection rules.";
  }

  if (event === "approval.approved" || entry.action === "approve") {
    return "You approved this action after reviewing it.";
  }

  if (event === "approval.rejected" || entry.action === "reject") {
    return "You rejected this action.";
  }

  if (event === "review.auto_denied") {
    return "Approval window expired before a decision was made.";
  }

  const reason = typeof meta.reason === "string" ? meta.reason.trim() : "";
  if (reason && !reason.toLowerCase().includes("policy engine")) {
    return reason.endsWith(".") ? reason : `${reason}.`;
  }

  return whyDecisionCopy(entry, event, meta, amount);
}

function buildPolicyResult(entry: AuditTimelineEntry, event: string): string {
  const meta = entry.metadata ?? {};

  switch (event) {
    case "policy.allow":
      return "Policy allowed this action automatically.";
    case "policy.review":
      return "Policy requires human approval before continuing.";
    case "policy.block":
    case "execution.denied":
      return "Policy blocked this action.";
    case "approval.approved":
      return "Policy required approval — you approved it.";
    case "approval.rejected":
    case "review.auto_denied":
      return "Policy required approval — it was not approved.";
    case "token.consumed":
    case "token.verified":
      return "Policy allowed execution after approval.";
    default:
      if (entry.action === "approve") {
        return "Human approval granted.";
      }
      if (entry.action === "reject") {
        return "Human approval denied.";
      }
      if (typeof meta.matchedPolicies === "object") {
        return "Matched your protection rules.";
      }
      return "Evaluated against your protection rules.";
  }
}

function buildRiskResult(entry: AuditTimelineEntry): string {
  if (entry.risk) {
    const level = entry.risk.charAt(0).toUpperCase() + entry.risk.slice(1);
    return `${level} risk level detected for this action.`;
  }

  const meta = entry.metadata ?? {};
  const riskLevel = typeof meta.riskLevel === "string" ? meta.riskLevel : null;
  if (riskLevel) {
    const level = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
    return `${level} risk level detected for this action.`;
  }

  return "Risk was evaluated as part of Wave's protection check.";
}

function buildApprovalInfo(entry: AuditTimelineEntry, event: string): string | null {
  if (event === "policy.review") {
    return "Waiting for a human decision before the agent can continue.";
  }

  if (event === "approval.approved" || entry.action === "approve") {
    const reviewer = entry.actorEmail ?? entry.actor;
    return reviewer ? `Approved by ${reviewer}.` : "Approved by a reviewer.";
  }

  if (event === "approval.rejected" || entry.action === "reject") {
    const reviewer = entry.actorEmail ?? entry.actor;
    return reviewer ? `Rejected by ${reviewer}.` : "Rejected by a reviewer.";
  }

  if (event === "review.auto_denied") {
    return "Expired — no approval decision was made in time.";
  }

  return null;
}

function buildExecutionResult(entry: AuditTimelineEntry, event: string): string {
  switch (event) {
    case "policy.allow":
    case "token.consumed":
    case "token.verified":
      return "The agent was allowed to complete the action.";
    case "policy.review":
      return "Paused — execution has not started yet.";
    case "policy.block":
    case "execution.denied":
    case "approval.rejected":
    case "review.auto_denied":
      return "The action did not run.";
    case "approval.approved":
      return "Approved — the agent can proceed with execution.";
    default:
      return actionTakenCopy(entry, event);
  }
}

function isToday(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function matchesDateFilter(timestamp: string, filter: DateFilter, now = Date.now()): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "today") {
    return isToday(timestamp, new Date(now));
  }

  const diff = now - new Date(timestamp).getTime();
  if (filter === "week") {
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }

  if (filter === "month") {
    return diff <= 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

function includesTool(meta: Record<string, unknown>, fragment: string): boolean {
  const toolName = typeof meta.toolName === "string" ? meta.toolName.toLowerCase() : "";
  const actionType =
    typeof meta.actionType === "string" ? meta.actionType.toLowerCase() : "";
  return toolName.includes(fragment) || actionType.includes(fragment);
}

function buildListMessage(
  entry: AuditTimelineEntry,
  event: string,
  meta: Record<string, unknown>,
  amount: string | null
): string {
  const agentName = resolveAgentName(entry);

  if (includesTool(meta, "email") || includesTool(meta, "mail")) {
    if (event === "token.consumed") {
      return `${agentName} sent email to customer`;
    }
    if (event === "policy.allow" || event === "approval.approved") {
      return "Sent refund status email to customer.";
    }
    return "Sent an email to a customer.";
  }

  if (includesTool(meta, "refund")) {
    if (event === "policy.review") {
      return amount
        ? `Requested approval for ${amount} refund.`
        : "Requested approval for a refund.";
    }
    if (event === "policy.allow" || event === "approval.approved" || event === "token.consumed") {
      return amount ? `Processed ${amount} refund.` : "Processed a refund.";
    }
    if (event === "approval.rejected") {
      return amount ? `Refund of ${amount} was rejected.` : "A refund request was rejected.";
    }
    if (event === "policy.block" || event === "execution.denied" || event === "review.auto_denied") {
      return amount ? `Blocked a ${amount} refund attempt.` : "Blocked a refund attempt.";
    }
  }

  if (includesTool(meta, "delete")) {
    return "Attempted to delete customer record.";
  }

  if (includesTool(meta, "export")) {
    if (event === "policy.review") {
      return "Requested approval to export customer data.";
    }
    if (event === "policy.block") {
      return "Blocked an attempt to export customer data.";
    }
    return "Exported customer data.";
  }

  if (event === "policy.review") {
    return "Requested approval for a sensitive action.";
  }
  if (event === "policy.allow" || event === "approval.approved" || event === "token.consumed") {
    return "Completed an approved action.";
  }
  if (event === "policy.block" || event === "execution.denied" || event === "review.auto_denied") {
    return "Attempted a blocked action.";
  }
  if (event === "approval.rejected") {
    return "An action was rejected.";
  }

  if (entry.action === "translate") {
    return "Translated agent logs into plain language.";
  }
  if (entry.action === "analyze") {
    return "Reviewed past agent activity for risks.";
  }
  if (entry.action === "upload") {
    return "Uploaded agent logs for review.";
  }
  if (entry.action === "approve") {
    return "You approved an agent action.";
  }
  if (entry.action === "reject") {
    return "You rejected an agent action.";
  }

  return entry.description || entry.title || "Agent activity recorded.";
}

function toneForEntry(entry: AuditTimelineEntry, event: string): ActivityTone {
  if (
    event === "policy.allow" ||
    event === "approval.approved" ||
    event === "token.consumed" ||
    event === "token.verified"
  ) {
    return "allowed";
  }

  if (event === "policy.review") {
    return "review";
  }

  if (
    event === "policy.block" ||
    event === "execution.denied" ||
    event === "approval.rejected" ||
    event === "review.auto_denied"
  ) {
    return "blocked";
  }

  if (entry.action === "approve") {
    return "allowed";
  }
  if (entry.action === "reject") {
    return "blocked";
  }

  return "neutral";
}

function whyDecisionCopy(
  entry: AuditTimelineEntry,
  event: string,
  meta: Record<string, unknown>,
  amount: string | null
): string {
  const reason = typeof meta.reason === "string" ? meta.reason.trim() : "";

  if (event === "policy.review" && includesTool(meta, "refund") && amount) {
    return "This refund is above your automatic limit of ₹5,000, so Wave paused it for you.";
  }

  if (event === "policy.review") {
    return "This action matched a rule that requires your approval before it can continue.";
  }

  if (event === "policy.allow") {
    return "This action was within your automatic safety limits.";
  }

  if (event === "policy.block" || event === "execution.denied") {
    if (includesTool(meta, "delete")) {
      return "Deleting customer records is never allowed for this agent.";
    }
    return "This action broke one of your protection rules, so Wave stopped it.";
  }

  if (event === "approval.approved" || entry.action === "approve") {
    return "You approved this action after reviewing it.";
  }

  if (event === "approval.rejected" || entry.action === "reject") {
    return "You rejected this action, so it could not continue.";
  }

  if (event === "review.auto_denied") {
    return "The approval window expired before a decision was made.";
  }

  if (reason && !reason.toLowerCase().includes("policy engine")) {
    return reason.endsWith(".") ? reason : `${reason}.`;
  }

  return entry.description || "Wave evaluated this action against your protection rules.";
}

function actionTakenCopy(entry: AuditTimelineEntry, event: string): string {
  switch (event) {
    case "policy.allow":
      return "Allowed automatically — the agent could proceed.";
    case "policy.review":
      return "Paused — waiting for your approval.";
    case "policy.block":
    case "execution.denied":
      return "Blocked — the action did not happen.";
    case "approval.approved":
    case "token.consumed":
    case "token.verified":
      return "Approved — the agent was allowed to complete the action.";
    case "approval.rejected":
    case "review.auto_denied":
      return "Rejected — the action did not happen.";
    default:
      if (entry.action === "approve") {
        return "You approved this action.";
      }
      if (entry.action === "reject") {
        return "You rejected this action.";
      }
      if (entry.action === "translate" || entry.action === "analyze" || entry.action === "upload") {
        return "Recorded for your review — this was a log analysis step, not a live agent action.";
      }
      return "Recorded in your activity history.";
  }
}

function shouldShowInFeed(entry: AuditTimelineEntry, event: string): boolean {
  if (entry.source === "runtime" && event && INTERNAL_RUNTIME_EVENTS.has(event)) {
    return false;
  }
  return true;
}

export function buildFounderActivityView(
  entry: AuditTimelineEntry,
  now = Date.now()
): FounderActivityView | null {
  const event = entry.runtimeEvent ?? "";
  const meta = entry.metadata ?? {};

  if (!shouldShowInFeed(entry, event)) {
    return null;
  }

  const tone = toneForEntry(entry, event);
  const amount = formatMoney(meta.amount, meta.currency);
  const agentId = resolveAgentId(entry);
  const agentName = resolveAgentName(entry);
  const actionLabel = buildActionLabel(meta, amount);
  const actionType = classifyActionType(meta);
  const message = buildListMessage(entry, event, meta, amount);
  const filterCategory =
    tone === "neutral" ? null : (tone as Exclude<ActivityFilter, "all">);
  const normalizedMessage = message.endsWith(".") ? message.slice(0, -1) : message;
  const decisionLabel = buildDecisionLabel(tone, event, meta);
  const reason = buildListReason(entry, event, meta, amount);
  const riskLabel = resolveRiskLabel(entry, meta);
  const statusLabel = buildStatusLabel(tone, event);
  const proposedAction = buildProposedAction(meta, actionLabel, amount);
  const zeltaChecked = buildZeltaChecked(entry, event, tone, riskLabel);
  const finalDecisionText = buildFinalDecisionText(tone, event);

  return {
    id: entry.id,
    agentId,
    agentName,
    actionLabel,
    actionType,
    decisionLabel,
    message,
    reason,
    tone,
    timestamp: entry.timestamp,
    relativeTime: formatRelativeTime(entry.timestamp, now),
    timeDisplay: formatTimeDisplay(entry.timestamp),
    riskLabel,
    statusLabel,
    proposedAction,
    zeltaChecked,
    finalDecisionText,
    isSimulated: false,
    whatHappened: `${agentName} ${normalizedMessage.charAt(0).toLowerCase()}${normalizedMessage.slice(1)}.`,
    whyDecision: whyDecisionCopy(entry, event, meta, amount),
    actionTaken: actionTakenCopy(entry, event),
    filterCategory,
    details: {
      agent: agentName,
      requestedAction: actionLabel,
      time: formatRelativeTime(entry.timestamp, now),
      timeFull: new Date(entry.timestamp).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      policyResult: buildPolicyResult(entry, event),
      riskResult: buildRiskResult(entry),
      finalDecision: decisionLabel,
      approvalInfo: buildApprovalInfo(entry, event),
      executionResult: buildExecutionResult(entry, event),
    },
    technical: {
      runtimeEvent: entry.runtimeEvent,
      proposalId: entry.proposalId,
      metadata: meta,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actor,
      actorEmail: entry.actorEmail,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      source: entry.source,
    },
  };
}

export function buildFounderActivityViews(
  entries: AuditTimelineEntry[],
  now = Date.now()
): FounderActivityView[] {
  return entries
    .map((entry) => buildFounderActivityView(entry, now))
    .filter((entry): entry is FounderActivityView => entry !== null);
}

export function filterFounderActivities(
  activities: FounderActivityView[],
  filter: ActivityFilter
): FounderActivityView[] {
  if (filter === "all") {
    return activities;
  }
  return activities.filter((activity) => activity.filterCategory === filter);
}

export function applyActivityFilters(
  activities: FounderActivityView[],
  filters: ActivityFilters,
  now = Date.now()
): FounderActivityView[] {
  return activities.filter((activity) => {
    if (filters.agent !== "all" && activity.agentId !== filters.agent) {
      return false;
    }

    if (
      filters.decision !== "all" &&
      activity.filterCategory !== filters.decision
    ) {
      return false;
    }

    if (filters.actionType !== "all" && activity.actionType !== filters.actionType) {
      return false;
    }

    if (!matchesDateFilter(activity.timestamp, filters.date, now)) {
      return false;
    }

    return true;
  });
}

export function getActivityAgentOptions(
  activities: FounderActivityView[]
): Array<{ id: string; label: string }> {
  const map = new Map<string, string>();
  for (const activity of activities) {
    map.set(activity.agentId, activity.agentName);
  }

  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function riskToneClass(risk: string): string {
  switch (risk.toLowerCase()) {
    case "critical":
      return "act-risk-critical";
    case "high":
      return "act-risk-high";
    case "medium":
      return "act-risk-medium";
    default:
      return "act-risk-low";
  }
}

export function statusToneClass(status: string): string {
  switch (status.toLowerCase()) {
    case "waiting":
      return "act-status-waiting";
    case "blocked":
      return "act-status-blocked";
    case "completed":
      return "act-status-completed";
    default:
      return "act-status-neutral";
  }
}

export function activityToneClass(tone: ActivityTone): string {
  switch (tone) {
    case "allowed":
      return "act-decision-allowed";
    case "review":
      return "act-decision-review";
    case "blocked":
      return "act-decision-blocked";
    default:
      return "act-decision-neutral";
  }
}

export function activityToneIcon(tone: ActivityTone): string {
  switch (tone) {
    case "allowed":
      return "🟢";
    case "review":
      return "🟡";
    case "blocked":
      return "🔴";
    default:
      return "⚪";
  }
}
