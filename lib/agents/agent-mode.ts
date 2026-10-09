import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentLifecycleProgress } from "@/lib/agent-builder/agent-lifecycle";
import { isAgentSetupLive } from "@/lib/agent-builder/setup-progress-steps";

export type AgentUsageMode = "standalone" | "protected";

/** DB-backed agent status shown on the agent hub. */
export function isAgentDbStatusActive(status: string): boolean {
  return status === "active" || status === "published" || status === "testing";
}

export function isAgentDbStatusPaused(status: string): boolean {
  return status === "paused";
}

export function resolveAgentDbDisplayStatus(status: string): "active" | "paused" {
  if (isAgentDbStatusPaused(status)) return "paused";
  if (isAgentDbStatusActive(status)) return "active";
  return "paused";
}

export interface AgentDisplayStatus {
  mode: AgentUsageMode;
  runtimeStatus: "active" | "paused";
  created: boolean;
  connected: boolean;
  protected: boolean;
  statusLabel: string;
  typeLabel: string;
  showSetupIncomplete: boolean;
}

export function isStandaloneAgent(lifecycle: AgentLifecycleProgress): boolean {
  if (lifecycle.mode === "protected") return false;
  if (lifecycle.mode === "standalone") return true;
  return Boolean(lifecycle.launched && !lifecycle.protectionConfigured);
}

export function isProtectedAgent(
  lifecycle: AgentLifecycleProgress,
  apiKey: AgentApiKeyRecord | null
): boolean {
  if (lifecycle.mode === "standalone" && !lifecycle.protectionConfigured) {
    return false;
  }
  return (
    lifecycle.protectionConfigured &&
    (isAgentSetupLive(lifecycle, apiKey) || lifecycle.mode === "protected")
  );
}

export function getAgentWorkspaceHref(agentId: string): string {
  return `/agents/${encodeURIComponent(agentId)}/setup`;
}

export function getAgentReadyHref(agentId: string): string {
  return `/agents/${encodeURIComponent(agentId)}/ready`;
}

export function getAgentProtectHref(agentId: string): string {
  return `/agents/${encodeURIComponent(agentId)}/setup`;
}

export function getAgentDisplayStatus(
  lifecycle: AgentLifecycleProgress,
  apiKey: AgentApiKeyRecord | null,
  typeLabel = "Created with Wave"
): AgentDisplayStatus {
  const standalone = isStandaloneAgent(lifecycle);
  const connected =
    lifecycle.connectionAcknowledged ||
    lifecycle.connectionTestPassed ||
    Boolean(apiKey?.lastUsedAt);
  const protectedAgent = isProtectedAgent(lifecycle, apiKey);
  const active = standalone
    ? lifecycle.launched || lifecycle.actionsConfigured
    : protectedAgent || lifecycle.activated;

  return {
    mode: standalone ? "standalone" : "protected",
    runtimeStatus: active ? "active" : "paused",
    created: true,
    connected,
    protected: protectedAgent,
    statusLabel: protectedAgent
      ? "Protected"
      : standalone && active
        ? "Active"
        : connected
          ? "Connected"
          : "Created",
    typeLabel,
    showSetupIncomplete: !standalone && !protectedAgent && !lifecycle.activated,
  };
}

export function createStandaloneLifecyclePatch(): Partial<AgentLifecycleProgress> {
  return {
    mode: "standalone",
    actionsConfigured: true,
    launched: true,
    activated: true,
    activatedAt: new Date().toISOString(),
    protectionConfigured: false,
    connectionAcknowledged: false,
    connectionTestPassed: false,
    testActionPassed: false,
  };
}

export function createProtectedLifecyclePatch(): Partial<AgentLifecycleProgress> {
  return {
    mode: "protected",
    actionsConfigured: true,
    launched: false,
    activated: false,
    activatedAt: null,
  };
}
