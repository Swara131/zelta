import type { AgentSpec } from "./types";

const SESSION_PREFIX = "zelta:created-agent:";

export interface CreatedAgentSession {
  spec: AgentSpec;
  plainKey: string;
  keyPrefix: string;
  agentId: string;
  createdAt: string;
  templateName?: string;
  templateSlug?: string;
}

function storageKey(agentId: string): string {
  return `${SESSION_PREFIX}${agentId}`;
}

export function saveCreatedAgentSession(session: CreatedAgentSession): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(session.agentId), JSON.stringify(session));
  } catch {
    // Ignore quota errors — success page still works without persisted key.
  }
}

export function loadCreatedAgentSession(agentId: string): CreatedAgentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatedAgentSession;
    if (parsed.agentId !== agentId || !parsed.spec?.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCreatedAgentSession(agentId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(agentId));
  } catch {
    // no-op
  }
}
