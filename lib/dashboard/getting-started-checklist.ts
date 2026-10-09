import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { buildAgentCards, isDemoAgent } from "@/lib/dashboard/founder-copy";

export interface GettingStartedStep {
  id: string;
  label: string;
  complete: boolean;
  href: string;
}

export interface GettingStartedChecklist {
  steps: GettingStartedStep[];
  currentStepId: string;
  realAgentCount: number;
}

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

function hasProtectionConfigured(agentKeys: AgentApiKeyRecord[]): boolean {
  return agentKeys.some((key) => loadAgentLifecycle(key.agentId).protectionConfigured);
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

export function buildGettingStartedChecklist(
  keys: AgentApiKeyRecord[],
  auditEntries: AuditTimelineEntry[]
): GettingStartedChecklist {
  const agentKeys = realAgentKeys(keys);
  const realAgentCount = agentKeys.length;
  const hasAgents = realAgentCount > 0;
  const protectionDone = hasProtectionConfigured(agentKeys);
  const firstActionDone = hasRunFirstAction(agentKeys, auditEntries);
  const activityReviewed = auditEntries.length > 0;

  const steps: GettingStartedStep[] = [
    {
      id: "signup",
      label: "Sign up",
      complete: true,
      href: "/settings",
    },
    {
      id: "create-agent",
      label: "Create or connect an agent",
      complete: hasAgents,
      href: "#cc-hero-cta",
    },
    {
      id: "protection",
      label: "Configure protection settings",
      complete: protectionDone,
      href: "/risk",
    },
    {
      id: "first-action",
      label: "Run your first action",
      complete: firstActionDone,
      href: resolveFirstActionHref(agentKeys),
    },
    {
      id: "activity-log",
      label: "Review the activity log",
      complete: activityReviewed,
      href: "/audit",
    },
  ];

  const currentStepId =
    steps.find((step) => !step.complete)?.id ?? steps[steps.length - 1]!.id;

  return {
    steps,
    currentStepId,
    realAgentCount,
  };
}

/** Show onboarding checklist while the user has fewer than three real agents. */
export function shouldShowGettingStartedChecklist(realAgentCount: number): boolean {
  return realAgentCount < 3;
}
