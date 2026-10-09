import type { AgentCapabilityId } from "@/lib/agent-builder/wizard-options";

const PREFIX = "zelta:agent-config:";

export interface StoredAgentConfig {
  agentId: string;
  name: string;
  description: string;
  purpose: string;
  agentType: string;
  triggerType: string;
  tools: string[];
  capabilities: AgentCapabilityId[];
  suggestedThreshold: number | null;
  updatedAt: string;
}

function storageKey(agentId: string): string {
  return `${PREFIX}${agentId}`;
}

export function saveAgentConfigCache(config: StoredAgentConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(config.agentId),
      JSON.stringify({ ...config, updatedAt: new Date().toISOString() })
    );
  } catch {
    // no-op
  }
}

export function loadAgentConfigCache(agentId: string): StoredAgentConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAgentConfig;
    if (parsed.agentId !== agentId || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}
