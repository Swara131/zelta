import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentCapabilityId } from "./wizard-options";
import type { AgentUsageMode } from "@/lib/agents/agent-mode";
import { isStandaloneAgent, isProtectedAgent } from "@/lib/agents/agent-mode";

export interface AgentLifecycleProgress {
  mode: AgentUsageMode;
  actionsConfigured: boolean;
  protectionConfigured: boolean;
  connectionAcknowledged: boolean;
  connectionTestPassed: boolean;
  testActionPassed: boolean;
  launched: boolean;
  activated: boolean;
  activatedAt: string | null;
  capabilities: AgentCapabilityId[];
}

const LIFECYCLE_PREFIX = "zelta:agent-lifecycle:";
const SETUP_STEP_PREFIX = "zelta:agent-setup-step:";

export const SETUP_WIZARD_STEPS = [
  { id: 1, key: "details", label: "Agent Details" },
  { id: 2, key: "actions", label: "Actions" },
  { id: 3, key: "protection", label: "Protection" },
  { id: 4, key: "connection", label: "Connection" },
  { id: 5, key: "test", label: "Test" },
  { id: 6, key: "activate", label: "Activate" },
] as const;

export type SetupWizardStepId = (typeof SETUP_WIZARD_STEPS)[number]["id"];

function defaultLifecycle(): AgentLifecycleProgress {
  return {
    mode: "standalone",
    actionsConfigured: false,
    protectionConfigured: false,
    connectionAcknowledged: false,
    connectionTestPassed: false,
    testActionPassed: false,
    launched: false,
    activated: false,
    activatedAt: null,
    capabilities: [],
  };
}

function lifecycleKey(agentId: string): string {
  return `${LIFECYCLE_PREFIX}${agentId}`;
}

export function loadAgentLifecycle(agentId: string): AgentLifecycleProgress {
  if (typeof window === "undefined") return defaultLifecycle();
  try {
    const raw = window.localStorage.getItem(lifecycleKey(agentId));
    if (!raw) return defaultLifecycle();
    const parsed = JSON.parse(raw) as Partial<AgentLifecycleProgress>;
    return { ...defaultLifecycle(), ...parsed };
  } catch {
    return defaultLifecycle();
  }
}

export function saveAgentLifecycle(
  agentId: string,
  patch: Partial<AgentLifecycleProgress>
): AgentLifecycleProgress {
  const current = loadAgentLifecycle(agentId);
  const next = { ...current, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(lifecycleKey(agentId), JSON.stringify(next));
    } catch {
      // no-op
    }
  }
  return next;
}

export function loadSetupWizardStep(agentId: string): SetupWizardStepId {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(`${SETUP_STEP_PREFIX}${agentId}`);
    const step = Number(raw);
    if (step >= 1 && step <= 6) return step as SetupWizardStepId;
  } catch {
    // no-op
  }
  return 1;
}

export function saveSetupWizardStep(agentId: string, step: SetupWizardStepId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${SETUP_STEP_PREFIX}${agentId}`, String(step));
  } catch {
    // no-op
  }
}

export function canActivateAgent(
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): boolean {
  const connectionOk =
    lifecycle.connectionTestPassed || !!key?.lastUsedAt;
  return (
    lifecycle.actionsConfigured &&
    lifecycle.protectionConfigured &&
    lifecycle.connectionAcknowledged &&
    connectionOk &&
    lifecycle.testActionPassed
  );
}

export function getActivationSummary(
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): {
  connection: "Connected" | "Not connected";
  protection: "Active" | "Not configured";
  test: "Passed" | "Not passed";
  allComplete: boolean;
} {
  const connectionOk =
    lifecycle.connectionTestPassed || !!key?.lastUsedAt;
  return {
    connection: connectionOk ? "Connected" : "Not connected",
    protection: lifecycle.protectionConfigured ? "Active" : "Not configured",
    test: lifecycle.testActionPassed ? "Passed" : "Not passed",
    allComplete: canActivateAgent(lifecycle, key),
  };
}

export type AgentCardLifecycleStatus =
  | "active"
  | "setup_incomplete"
  | "connected"
  | "protected";

export interface AgentCardLifecycleView {
  status: AgentCardLifecycleStatus;
  statusLabel: string;
  statusEmoji: string;
  connectionLabel: string;
  protectionLabel: string;
  setupHref: string;
  dashboardHref: string;
  progressLines: string[];
}

export function getAgentCardLifecycleView(
  agentId: string,
  key: AgentApiKeyRecord | null,
  lifecycle: AgentLifecycleProgress
): AgentCardLifecycleView {
  const setupHref = `/agents/${encodeURIComponent(agentId)}/setup`;
  const dashboardHref = setupHref;
  const summary = getActivationSummary(lifecycle, key);

  const progressLines = [
    "Agent created ✓",
    lifecycle.actionsConfigured ? "Actions configured ✓" : "Configure actions",
    lifecycle.protectionConfigured ? "Protection configured ✓" : "Configure protection",
    summary.connection === "Connected" ? "Connected ✓" : "Connect agent",
    lifecycle.testActionPassed ? "Test passed ✓" : "Run test action",
    lifecycle.activated ? "Activated ✓" : "Activate agent",
  ];

  if (isProtectedAgent(lifecycle, key)) {
    return {
      status: "protected",
      statusLabel: "Protected",
      statusEmoji: "🟢",
      connectionLabel: summary.connection,
      protectionLabel: "Protected",
      setupHref,
      dashboardHref,
      progressLines,
    };
  }

  if (isStandaloneAgent(lifecycle) && (lifecycle.launched || lifecycle.actionsConfigured)) {
    return {
      status: "active",
      statusLabel: "Active",
      statusEmoji: "🟢",
      connectionLabel: "Not required",
      protectionLabel: "Optional",
      setupHref,
      dashboardHref,
      progressLines: ["Agent created ✓", "Ready to use ✓", "Protection optional"],
    };
  }

  if (summary.connection === "Connected" && lifecycle.actionsConfigured) {
    return {
      status: "connected",
      statusLabel: "Connected",
      statusEmoji: "🟡",
      connectionLabel: "Connected",
      protectionLabel: lifecycle.protectionConfigured ? "Active" : "Not configured",
      setupHref,
      dashboardHref,
      progressLines,
    };
  }

  return {
    status: "setup_incomplete",
    statusLabel: "Setup incomplete",
    statusEmoji: "🟡",
    connectionLabel: summary.connection,
    protectionLabel: lifecycle.protectionConfigured ? "Active" : "Not configured",
    setupHref,
    dashboardHref,
    progressLines,
  };
}

export function setupStepCompletion(lifecycle: AgentLifecycleProgress): boolean[] {
  return [
    true,
    lifecycle.actionsConfigured,
    lifecycle.protectionConfigured,
    lifecycle.connectionAcknowledged,
    lifecycle.testActionPassed,
    lifecycle.activated,
  ];
}
