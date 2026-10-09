import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { AgentSpec } from "./types";
import { humanizeAgentLabel, describeAgentPurpose } from "@/lib/dashboard/founder-copy";
import type { PendingApproval } from "@/lib/approval-types";
import {
  getAgentCardLifecycleView,
  loadAgentLifecycle,
  saveAgentLifecycle,
  type AgentCardLifecycleView,
  type AgentLifecycleProgress,
} from "./agent-lifecycle";

export interface AgentSetupContext {
  agentId: string;
  key: AgentApiKeyRecord | null;
  spec: AgentSpec | null;
  approvals: PendingApproval[];
  auditEntries: AuditTimelineEntry[];
}

export function computeAgentOnboarding(
  context: AgentSetupContext,
  options: { lifecycle?: AgentLifecycleProgress } = {}
) {
  const lifecycle = options.lifecycle ?? loadAgentLifecycle(context.agentId);
  const view = getAgentCardLifecycleView(context.agentId, context.key, lifecycle);
  const pending = context.approvals.filter((a) => a.agentId === context.agentId).length;

  if (pending > 0) {
    return {
      phase: "protected" as const,
      progress: {
        agentCreated: !!context.key,
        connectionComplete: view.connectionLabel === "Connected",
        protectionConfigured: lifecycle.protectionConfigured,
        tested: lifecycle.testActionPassed,
      },
      statusLabel: "Approval waiting",
      statusEmoji: "🟡",
      primaryCta: { label: "Review Approval →", href: "/approvals" },
      progressLines: view.progressLines,
    };
  }

  return {
    phase:
      view.status === "protected"
        ? ("protected" as const)
        : view.status === "connected"
          ? ("needs_protection" as const)
          : ("needs_connection" as const),
    progress: {
      agentCreated: !!context.key,
      connectionComplete: view.connectionLabel === "Connected",
      protectionConfigured: lifecycle.protectionConfigured,
      tested: lifecycle.testActionPassed,
    },
    statusLabel: view.statusLabel,
    statusEmoji: view.statusEmoji,
    primaryCta: {
      label:
        view.status === "protected"
          ? "Open Agent Dashboard →"
          : "Continue Setup →",
      href: view.status === "protected" ? view.dashboardHref : view.setupHref,
    },
    progressLines: view.progressLines,
  };
}

export function buildAgentSetupSummary(context: AgentSetupContext) {
  const { agentId, key, spec, auditEntries } = context;
  const name = spec?.name ?? humanizeAgentLabel(agentId, key?.name);
  const description =
    spec?.summary?.trim() ||
    spec?.purpose?.trim() ||
    describeAgentPurpose(agentId, key?.name);
  const agentType = spec ? "Created with Wave" : "Connected agent";
  const createdAt = key?.createdAt
    ? new Date(key.createdAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const lifecycle = loadAgentLifecycle(agentId);
  const view = getAgentCardLifecycleView(agentId, key, lifecycle);
  const actionsMonitored = auditEntries.filter((entry) => {
    const id =
      (typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null) ??
      entry.actor;
    return id === agentId;
  }).length;

  return {
    name,
    description,
    agentType,
    createdAt,
    connectionLabel: view.connectionLabel,
    protectionLabel: view.protectionLabel,
    actionsMonitored,
  };
}

export function getAgentLifecycleView(
  agentId: string,
  key: AgentApiKeyRecord | null,
  lifecycle?: AgentLifecycleProgress
): AgentCardLifecycleView {
  return getAgentCardLifecycleView(
    agentId,
    key,
    lifecycle ?? loadAgentLifecycle(agentId)
  );
}

export {
  loadAgentLifecycle,
  saveAgentLifecycle,
  loadSetupWizardStep,
  saveSetupWizardStep,
  canActivateAgent,
  getActivationSummary,
  setupStepCompletion,
  SETUP_WIZARD_STEPS,
} from "./agent-lifecycle";

export type { AgentLifecycleProgress, AgentCardLifecycleView, SetupWizardStepId } from "./agent-lifecycle";

const TESTED_PREFIX = "zelta:agent-tested:";

export function markAgentTested(agentId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TESTED_PREFIX}${agentId}`, new Date().toISOString());
    saveAgentLifecycle(agentId, { testActionPassed: true });
  } catch {
    // no-op
  }
}

export function markAgentProtectionConfigured(agentId?: string): void {
  if (agentId) {
    saveAgentLifecycle(agentId, { protectionConfigured: true });
  }
}

/** @deprecated Global flag — prefer per-agent lifecycle. */
export function isAgentProtectionConfigured(): boolean {
  return false;
}

export const ONBOARDING_STEPS = [
  { id: "details", label: "Agent Details" },
  { id: "actions", label: "Actions" },
  { id: "protection", label: "Protection" },
  { id: "connection", label: "Connection" },
  { id: "test", label: "Test" },
  { id: "activate", label: "Activate" },
] as const;

export function stepCompletion(lifecycle: AgentLifecycleProgress): boolean[] {
  return [
    true,
    lifecycle.actionsConfigured,
    lifecycle.protectionConfigured,
    lifecycle.connectionAcknowledged,
    lifecycle.testActionPassed,
    lifecycle.activated,
  ];
}
