import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import {
  describeApprovalHeadline,
  humanizeAgentLabel,
} from "@/lib/dashboard/founder-copy";
import {
  buildRecentAgentActions,
  type AgentActionActivity,
} from "@/lib/audit/agent-actions";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";

export const CONTROL_CENTER_DEMO_DISCLAIMER =
  "Sample data — connect an agent to see your real protection activity.";

export interface SecurityStatusSummary {
  agentCount: number;
  protectionLabel: string;
  protectionTone: "good" | "warn" | "neutral";
  actionsEvaluated: number;
  allowed: number;
  awaitingApproval: number;
  blocked: number;
  isSimulated: boolean;
}

export interface AttentionItem {
  id: string;
  headline: string;
  agentName: string;
  riskLabel: string;
  decisionLabel: string;
  href: string;
  cta: string;
  isSimulated: boolean;
}

export type RecentActivityRow = AgentActionActivity;

export interface SetupChecklistItem {
  id: string;
  label: string;
  complete: boolean;
}

export interface SetupProgress {
  items: SetupChecklistItem[];
  continueHref: string;
  showContinue: boolean;
  allComplete: boolean;
}

export interface ControlCenterData {
  hasAgents: boolean;
  hasRealActivity: boolean;
  isSimulated: boolean;
  securityStatus: SecurityStatusSummary;
  attentionItems: AttentionItem[];
  recentActivity: RecentActivityRow[];
  setupProgress: SetupProgress;
}

const DEMO_SECURITY_STATUS: Omit<SecurityStatusSummary, "isSimulated"> = {
  agentCount: 1,
  protectionLabel: "Protected",
  protectionTone: "good",
  actionsEvaluated: 24,
  allowed: 17,
  awaitingApproval: 4,
  blocked: 3,
};

const DEMO_ATTENTION: AttentionItem = {
  id: "demo-attention-refund",
  headline: "Refund ₹25,000",
  agentName: "Customer Refund Agent",
  riskLabel: "High",
  decisionLabel: "Approval required",
  href: "/approvals",
  cta: "Review",
  isSimulated: true,
};

function formatRiskLabel(level: unknown): string {
  if (typeof level !== "string" || !level.trim()) return "High";
  const normalized = level.toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function countOutcomeTotals(auditEntries: AuditTimelineEntry[]): {
  evaluated: number;
  allowed: number;
  blocked: number;
} {
  let evaluated = 0;
  let allowed = 0;
  let blocked = 0;

  for (const entry of auditEntries) {
    const event = entry.runtimeEvent ?? "";
    if (
      event === "proposal.created" ||
      event.startsWith("policy.") ||
      event === "decision.composed"
    ) {
      evaluated += 1;
    }
    if (
      event === "policy.allow" ||
      event === "approval.approved" ||
      event === "token.consumed" ||
      event === "token.verified"
    ) {
      allowed += 1;
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

  return { evaluated, allowed, blocked };
}

function resolveProtectionLabel(activeKeys: AgentApiKeyRecord[]): {
  label: string;
  tone: SecurityStatusSummary["protectionTone"];
} {
  if (activeKeys.length === 0) {
    return { label: "No agents yet", tone: "neutral" };
  }

  const statuses = activeKeys.map((key) => {
    const lifecycle = loadAgentLifecycle(key.agentId);
    return lifecycle.activated && lifecycle.testActionPassed;
  });

  if (statuses.every(Boolean)) {
    return { label: "Protected", tone: "good" };
  }

  if (statuses.some(Boolean)) {
    return { label: "Partially protected", tone: "warn" };
  }

  return { label: "Setup incomplete", tone: "warn" };
}

function buildSecurityStatus(
  activeKeys: AgentApiKeyRecord[],
  approvals: PendingApproval[],
  auditEntries: AuditTimelineEntry[],
  hasRealActivity: boolean,
  isSimulated: boolean
): SecurityStatusSummary {
  if (isSimulated) {
    return { ...DEMO_SECURITY_STATUS, isSimulated: true };
  }

  const { label, tone } = resolveProtectionLabel(activeKeys);
  const totals = countOutcomeTotals(auditEntries);

  return {
    agentCount: activeKeys.length,
    protectionLabel: label,
    protectionTone: tone,
    actionsEvaluated: totals.evaluated,
    allowed: totals.allowed,
    awaitingApproval: approvals.length,
    blocked: totals.blocked,
    isSimulated: false,
  };
}

function mapApprovalToAttention(approval: PendingApproval): AttentionItem {
  const tool = (approval.toolName ?? "").toLowerCase();
  const payload = approval.actionPayload ?? {};
  let headline = describeApprovalHeadline(approval);

  if (tool.includes("refund") && typeof payload.amount === "number") {
    const amount =
      payload.amount >= 100 ? payload.amount / 100 : payload.amount;
    headline = `Refund ₹${Math.round(amount).toLocaleString("en-IN")}`;
  }

  return {
    id: approval.id,
    headline,
    agentName: humanizeAgentLabel(approval.agentId),
    riskLabel: formatRiskLabel(approval.riskSeverity),
    decisionLabel: "Approval required",
    href: "/approvals",
    cta: "Review",
    isSimulated: false,
  };
}

function buildAttentionRows(
  approvals: PendingApproval[],
  isSimulated: boolean
): AttentionItem[] {
  if (approvals.length > 0) {
    return approvals.slice(0, 5).map(mapApprovalToAttention);
  }

  if (isSimulated) {
    return [DEMO_ATTENTION];
  }

  return [];
}

function buildRecentActivityRows(
  auditEntries: AuditTimelineEntry[],
  includeDemo: boolean
): RecentActivityRow[] {
  return buildRecentAgentActions(auditEntries, {
    limit: 5,
    includeDemo,
  });
}

function buildSetupProgress(activeKeys: AgentApiKeyRecord[]): SetupProgress {
  const hasAgents = activeKeys.length > 0;

  let protectionConfigured = false;
  let connected = false;
  let tested = false;
  let firstIncompleteAgentId: string | null = null;

  for (const key of activeKeys) {
    const lifecycle = loadAgentLifecycle(key.agentId);
    if (lifecycle.protectionConfigured) protectionConfigured = true;
    if (lifecycle.connectionAcknowledged || key.lastUsedAt) connected = true;
    if (lifecycle.testActionPassed) tested = true;

    const complete = lifecycle.activated && lifecycle.testActionPassed;
    if (!complete && !firstIncompleteAgentId) {
      firstIncompleteAgentId = key.agentId;
    }
  }

  const items: SetupChecklistItem[] = [
    { id: "create", label: "Create your agent", complete: hasAgents },
    { id: "protection", label: "Configure protection", complete: protectionConfigured },
    { id: "connect", label: "Connect your agent", complete: connected },
    { id: "test", label: "Run your first test", complete: tested },
  ];

  const allComplete = items.every((item) => item.complete);

  let continueHref = "/agents/build";
  if (hasAgents && !protectionConfigured) {
    continueHref = "/risk";
  } else if (hasAgents && !connected) {
    continueHref = "/onboarding/connect";
  } else if (hasAgents && !tested && firstIncompleteAgentId) {
    continueHref = `/agents/${encodeURIComponent(firstIncompleteAgentId)}/setup`;
  } else if (hasAgents && firstIncompleteAgentId) {
    continueHref = `/agents/${encodeURIComponent(firstIncompleteAgentId)}/setup`;
  } else if (hasAgents) {
    continueHref = "/integrations";
  }

  return {
    items,
    continueHref,
    showContinue: !allComplete,
    allComplete,
  };
}

export function buildControlCenterData(
  keys: AgentApiKeyRecord[],
  approvals: PendingApproval[],
  auditEntries: AuditTimelineEntry[]
): ControlCenterData {
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const hasAgents = activeKeys.length > 0;
  const hasRealActivity = auditEntries.length > 0;
  const isSimulated = !hasRealActivity;

  const securityStatus = buildSecurityStatus(
    activeKeys,
    approvals,
    auditEntries,
    hasRealActivity,
    isSimulated && !hasAgents
  );

  if (hasAgents && !hasRealActivity) {
    securityStatus.isSimulated = false;
    securityStatus.agentCount = activeKeys.length;
    const { label, tone } = resolveProtectionLabel(activeKeys);
    securityStatus.protectionLabel = label;
    securityStatus.protectionTone = tone;
    securityStatus.actionsEvaluated = 0;
    securityStatus.allowed = 0;
    securityStatus.awaitingApproval = approvals.length;
    securityStatus.blocked = 0;
  }

  const attentionItems = buildAttentionRows(
    approvals,
    !hasAgents && !hasRealActivity
  );

  const recentActivity = buildRecentActivityRows(
    auditEntries,
    !hasAgents && !hasRealActivity
  );

  const setupProgress = buildSetupProgress(activeKeys);

  return {
    hasAgents,
    hasRealActivity,
    isSimulated: !hasAgents && !hasRealActivity,
    securityStatus,
    attentionItems,
    recentActivity,
    setupProgress,
  };
}
