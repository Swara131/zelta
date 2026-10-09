import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { formatCompactRelativeTime } from "@/lib/audit/agent-actions";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { isProtectedAgent, isStandaloneAgent } from "@/lib/agents/agent-mode";

export interface SecurityOverviewMetrics {
  totalActionsReviewed: number;
  blockedRiskyActions: number;
  humanApprovalRate: number;
  isSimulated: boolean;
}

export interface AgentTrustMetrics {
  lastActivityLabel: string;
  lastActivityAt: string | null;
  actionsProtectedThisMonth: number;
  averageRiskScore: number;
  riskLabel: "Low" | "Medium" | "High";
  riskBarPercent: number;
  isProtected: boolean;
  statusBadge: "protected" | "setup_needed";
  statusLabel: string;
}

const REVIEW_EVENTS = new Set([
  "proposal.created",
  "decision.composed",
  "policy.allow",
  "policy.review",
  "policy.block",
]);

const BLOCK_EVENTS = new Set([
  "policy.block",
  "approval.rejected",
  "execution.denied",
  "review.auto_denied",
]);

const APPROVAL_EVENTS = new Set(["policy.review", "approval.approved", "approval.rejected"]);

const DEMO_OVERVIEW: SecurityOverviewMetrics = {
  totalActionsReviewed: 312,
  blockedRiskyActions: 4,
  humanApprovalRate: 2.1,
  isSimulated: true,
};

function isGatewayEvent(entry: AuditTimelineEntry): boolean {
  return Boolean(entry.runtimeEvent || entry.source === "runtime");
}

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function extractRiskScore(entry: AuditTimelineEntry): number | null {
  const meta = entry.metadata ?? {};
  const raw = meta.riskScore ?? meta.risk_score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > 1) return Math.min(raw / 100, 1);
  return Math.max(0, Math.min(raw, 1));
}

function riskLabelForScore(score: number): AgentTrustMetrics["riskLabel"] {
  if (score < 0.35) return "Low";
  if (score <= 0.65) return "Medium";
  return "High";
}

export function buildSecurityOverviewMetrics(
  auditEntries: AuditTimelineEntry[]
): SecurityOverviewMetrics {
  const gatewayEntries = auditEntries.filter(isGatewayEvent);

  if (gatewayEntries.length === 0) {
    return { ...DEMO_OVERVIEW, isSimulated: true };
  }

  let reviewed = 0;
  let blocked = 0;
  let approvalRouted = 0;

  for (const entry of gatewayEntries) {
    const event = entry.runtimeEvent ?? "";
    if (REVIEW_EVENTS.has(event) || event.startsWith("policy.")) {
      reviewed += 1;
    }
    if (BLOCK_EVENTS.has(event)) {
      blocked += 1;
    }
    if (APPROVAL_EVENTS.has(event)) {
      approvalRouted += 1;
    }
  }

  const totalReviewed = Math.max(reviewed, gatewayEntries.length);
  const approvalRate =
    totalReviewed > 0 ? (approvalRouted / totalReviewed) * 100 : 0;

  return {
    totalActionsReviewed: totalReviewed,
    blockedRiskyActions: blocked,
    humanApprovalRate: Math.round(approvalRate * 10) / 10,
    isSimulated: false,
  };
}

function latestActivityForAgent(
  agentId: string,
  apiKey: AgentApiKeyRecord | null,
  auditEntries: AuditTimelineEntry[]
): string | null {
  let latest: string | null = apiKey?.lastUsedAt ?? null;

  for (const entry of auditEntries) {
    const metaAgentId =
      typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null;
    const entryAgentId =
      metaAgentId ??
      (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null);

    if (entryAgentId !== agentId) continue;
    if (!latest || entry.timestamp > latest) {
      latest = entry.timestamp;
    }
  }

  return latest;
}

function countMonthlyActions(agentId: string, auditEntries: AuditTimelineEntry[]): number {
  const monthStart = startOfMonth().toISOString();
  let count = 0;

  for (const entry of auditEntries) {
    if (entry.timestamp < monthStart) continue;

    const metaAgentId =
      typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null;
    const entryAgentId =
      metaAgentId ??
      (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null);

    if (entryAgentId !== agentId) continue;

    const event = entry.runtimeEvent ?? "";
    if (
      event === "proposal.created" ||
      event.startsWith("policy.") ||
      event === "decision.composed" ||
      event === "token.consumed"
    ) {
      count += 1;
    }
  }

  return count;
}

function averageRiskForAgent(agentId: string, auditEntries: AuditTimelineEntry[]): number {
  const scores: number[] = [];

  for (const entry of auditEntries) {
    const metaAgentId =
      typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null;
    const entryAgentId =
      metaAgentId ??
      (entry.actor !== "Gateway" && entry.actor !== "Policy Engine" ? entry.actor : null);

    if (entryAgentId !== agentId) continue;

    const score = extractRiskScore(entry);
    if (score !== null) scores.push(score);
  }

  if (scores.length === 0) return 0.34;

  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return Math.round(avg * 100) / 100;
}

export function buildAgentTrustMetrics(
  agentId: string,
  apiKey: AgentApiKeyRecord | null,
  auditEntries: AuditTimelineEntry[],
  actionsCheckedFallback = 0
): AgentTrustMetrics {
  const lifecycle = loadAgentLifecycle(agentId);
  const isFullyProtected = isProtectedAgent(lifecycle, apiKey);
  const standaloneActive =
    isStandaloneAgent(lifecycle) && (lifecycle.launched || lifecycle.actionsConfigured);
  const isProtected = isFullyProtected;

  const lastActivityAt = latestActivityForAgent(agentId, apiKey, auditEntries);
  const monthlyActions = countMonthlyActions(agentId, auditEntries);
  const actionsProtectedThisMonth =
    monthlyActions > 0 ? monthlyActions : actionsCheckedFallback;

  const averageRiskScore = averageRiskForAgent(agentId, auditEntries);
  const riskLabel = riskLabelForScore(averageRiskScore);

  return {
    lastActivityLabel: lastActivityAt
      ? formatCompactRelativeTime(lastActivityAt)
      : "No activity yet",
    lastActivityAt,
    actionsProtectedThisMonth,
    averageRiskScore,
    riskLabel,
    riskBarPercent: Math.round(averageRiskScore * 100),
    isProtected,
    statusBadge: isProtected ? "protected" : standaloneActive ? "protected" : "setup_needed",
    statusLabel: isProtected
      ? "Protected"
      : standaloneActive
        ? "Active"
        : "Setup needed",
  };
}

export const TRUST_BANNER_ITEMS = [
  { icon: "🔒", label: "All agent actions are gated before execution" },
  { icon: "✓", label: "Audit logs retained for 1 year" },
  { icon: "✓", label: "SOC 2 Type II compliance ready" },
] as const;
