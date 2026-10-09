import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentLifecycleProgress } from "./agent-lifecycle";

export type SetupProgressStepId =
  | "created"
  | "actions"
  | "protection"
  | "connect"
  | "test";

export interface SetupProgressStep {
  id: SetupProgressStepId;
  label: string;
  complete: boolean;
  /** Opens an in-card modal (protection, connect, test) */
  modal?: "protection" | "connect" | "test";
  /** Navigate to setup wizard when incomplete */
  setupHref?: string;
}

export function isAgentSetupLive(
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): boolean {
  const connected =
    lifecycle.connectionAcknowledged ||
    lifecycle.connectionTestPassed ||
    !!key?.lastUsedAt;

  return (
    lifecycle.actionsConfigured &&
    lifecycle.protectionConfigured &&
    connected &&
    lifecycle.testActionPassed
  );
}

/** All four setup checklist steps are complete. */
export function isSetupChecklistComplete(
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): boolean {
  return isAgentSetupLive(lifecycle, key);
}

export function getSetupProgressSteps(
  agentId: string,
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): SetupProgressStep[] {
  const setupBase = `/agents/${encodeURIComponent(agentId)}/setup`;
  const connected =
    lifecycle.connectionAcknowledged ||
    lifecycle.connectionTestPassed ||
    !!key?.lastUsedAt;

  return [
    {
      id: "created",
      label: "Agent created",
      complete: true,
    },
    {
      id: "actions",
      label: "Actions configured",
      complete: lifecycle.actionsConfigured,
      setupHref: lifecycle.actionsConfigured ? undefined : `${setupBase}?wizard=2`,
    },
    {
      id: "protection",
      label: "Configure protection",
      complete: lifecycle.protectionConfigured,
      modal: lifecycle.protectionConfigured ? undefined : "protection",
    },
    {
      id: "connect",
      label: "Connect agent",
      complete: connected,
      modal: connected ? undefined : "connect",
    },
    {
      id: "test",
      label: "Run test action",
      complete: lifecycle.testActionPassed,
      modal: lifecycle.testActionPassed ? undefined : "test",
    },
  ];
}
