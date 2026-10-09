import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import type { ExternalAgentConnection } from "./types";

export function readExternalConnection(
  safetySettings: AgentSafetySettings | Record<string, unknown> | undefined
): ExternalAgentConnection | null {
  const settings = (safetySettings ?? {}) as AgentSafetySettings;
  const raw = settings.externalConnection;
  if (!raw || typeof raw !== "object") return null;
  return raw as ExternalAgentConnection;
}

export function writeExternalConnection(
  safetySettings: AgentSafetySettings | Record<string, unknown> | undefined,
  connection: ExternalAgentConnection
): AgentSafetySettings {
  const base = { ...(safetySettings ?? {}) } as AgentSafetySettings;
  return {
    ...base,
    externalConnection: {
      ...connection,
      updatedAt: new Date().toISOString(),
    },
  };
}
