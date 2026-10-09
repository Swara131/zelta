import type { AgentBuildView } from "./build-response";

export interface AgentDraft {
  id: string;
  savedAt: string;
  build: AgentBuildView;
}

const STORAGE_KEY = "zelta:agent-drafts";

export function loadAgentDrafts(): AgentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAgentDraft(build: AgentBuildView): AgentDraft {
  const draft: AgentDraft = {
    id: `draft-${Date.now()}`,
    savedAt: new Date().toISOString(),
    build,
  };

  const existing = loadAgentDrafts();
  const withoutDuplicate = existing.filter(
    (item) => item.build.spec.agentId !== build.spec.agentId
  );
  const next = [draft, ...withoutDuplicate].slice(0, 10);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return draft;
}
