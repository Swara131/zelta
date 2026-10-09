import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { buildAgentCards, isDemoAgent } from "@/lib/dashboard/founder-copy";

export const PLATFORM_TRUST_STATS = [
  "312 actions protected today",
  "Zero false positives this month",
  "99.9% uptime SLA",
] as const;

export const SETUP_VIDEO_HREF = "/#how-it-works";

export interface OnboardingProgressStep {
  id: string;
  label: string;
  complete: boolean;
  href: string;
}

export interface OnboardingProgress {
  steps: OnboardingProgressStep[];
  percentComplete: number;
  nextStepLabel: string;
  nextStepHref: string;
}

export interface MonthlyProtectionSummary {
  totalActions: number;
  autoApproved: number;
  flaggedReviewed: number;
  hasActivity: boolean;
}

const DEMO_MONTHLY_SUMMARY: MonthlyProtectionSummary = {
  totalActions: 142,
  autoApproved: 140,
  flaggedReviewed: 2,
  hasActivity: true,
};

function isDemoKey(key: AgentApiKeyRecord): boolean {
  const card = buildAgentCards([key], [], []).at(0);
  return card ? isDemoAgent(card) : false;
}

function realAgentKeys(keys: AgentApiKeyRecord[]): AgentApiKeyRecord[] {
  const active = keys.filter((key) => !key.revokedAt);
  const byAgent = new Map<string, AgentApiKeyRecord>();

  for (const key of active) {
    if (isDemoKey(key)) continue;

    const existing = byAgent.get(key.agentId);
    if (
      !existing ||
      (key.lastUsedAt && (!existing.lastUsedAt || key.lastUsedAt > existing.lastUsedAt))
    ) {
      byAgent.set(key.agentId, key);
    }
  }

  return Array.from(byAgent.values());
}

function hasRunFirstAction(
  agentKeys: AgentApiKeyRecord[],
  auditEntries: AuditTimelineEntry[]
): boolean {
  const lifecycleComplete = agentKeys.some((key) => {
    const lifecycle = loadAgentLifecycle(key.agentId);
    return lifecycle.testActionPassed || Boolean(key.lastUsedAt);
  });

  if (lifecycleComplete) return true;

  return auditEntries.some((entry) => {
    const event = entry.runtimeEvent ?? "";
    return (
      event === "proposal.created" ||
      event.startsWith("policy.") ||
      event === "token.consumed" ||
      event === "token.verified"
    );
  });
}

function resolveFirstActionHref(agentKeys: AgentApiKeyRecord[]): string {
  const firstKey = agentKeys[0];
  if (!firstKey) return "/test-action";

  const lifecycle = loadAgentLifecycle(firstKey.agentId);
  if (!lifecycle.testActionPassed) {
    return `/agents/${encodeURIComponent(firstKey.agentId)}/setup`;
  }

  return "/test-action";
}

function isThisMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

function isEvaluatedActionEvent(event: string): boolean {
  return (
    event === "proposal.created" ||
    event.startsWith("policy.") ||
    event === "decision.composed"
  );
}

export function buildOnboardingProgress(
  keys: AgentApiKeyRecord[],
  auditEntries: AuditTimelineEntry[]
): OnboardingProgress {
  const agentKeys = realAgentKeys(keys);
  const hasAgents = agentKeys.length > 0;
  const firstActionDone = hasRunFirstAction(agentKeys, auditEntries);
  const auditReviewed = auditEntries.some((entry) => {
    const event = entry.runtimeEvent ?? "";
    return event.startsWith("policy.") || event === "proposal.created";
  });

  const steps: OnboardingProgressStep[] = [
    {
      id: "signup",
      label: "Signed up",
      complete: true,
      href: "/settings",
    },
    {
      id: "create-agent",
      label: "Created/Connected agent",
      complete: hasAgents,
      href: "#cc-hero-cta",
    },
    {
      id: "first-action",
      label: "Ran first action",
      complete: firstActionDone,
      href: resolveFirstActionHref(agentKeys),
    },
    {
      id: "audit-log",
      label: "Reviewed audit log",
      complete: auditReviewed,
      href: "/audit",
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const percentComplete = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.complete) ?? steps[steps.length - 1]!;

  return {
    steps,
    percentComplete,
    nextStepLabel: nextStep.label,
    nextStepHref: nextStep.href,
  };
}

export function buildMonthlyProtectionSummary(
  auditEntries: AuditTimelineEntry[],
  options?: { useDemoFallback?: boolean }
): MonthlyProtectionSummary {
  const monthEntries = auditEntries.filter((entry) => isThisMonth(entry.timestamp));

  let totalActions = 0;
  let autoApproved = 0;
  let flaggedReviewed = 0;

  for (const entry of monthEntries) {
    const event = entry.runtimeEvent ?? "";

    if (isEvaluatedActionEvent(event)) {
      totalActions += 1;
    }

    if (
      event === "policy.allow" ||
      event === "token.consumed" ||
      event === "token.verified"
    ) {
      autoApproved += 1;
    }

    if (event === "approval.approved") {
      flaggedReviewed += 1;
    }
  }

  if (totalActions === 0 && options?.useDemoFallback) {
    return DEMO_MONTHLY_SUMMARY;
  }

  return {
    totalActions,
    autoApproved: Math.max(autoApproved, 0),
    flaggedReviewed,
    hasActivity: totalActions > 0,
  };
}
