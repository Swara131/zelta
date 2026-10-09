export interface WorkspaceMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

export interface WorkspaceRun {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceStats {
  messagesSent: number;
  runsCompleted: number;
  lastActiveAt: string | null;
}

const MSG_PREFIX = "zelta:agent-workspace-msgs:";
const RUN_PREFIX = "zelta:agent-workspace-runs:";
const STATS_PREFIX = "zelta:agent-workspace-stats:";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

export function loadWorkspaceMessages(agentId: string): WorkspaceMessage[] {
  return readJson<WorkspaceMessage[]>(`${MSG_PREFIX}${agentId}`, []);
}

export function saveWorkspaceMessage(agentId: string, message: WorkspaceMessage): void {
  const messages = loadWorkspaceMessages(agentId);
  writeJson(`${MSG_PREFIX}${agentId}`, [...messages, message]);
}

export function loadWorkspaceRuns(agentId: string): WorkspaceRun[] {
  return readJson<WorkspaceRun[]>(`${RUN_PREFIX}${agentId}`, []);
}

export function saveWorkspaceRun(agentId: string, run: WorkspaceRun): void {
  const runs = loadWorkspaceRuns(agentId);
  writeJson(`${RUN_PREFIX}${agentId}`, [run, ...runs].slice(0, 20));
}

export function loadWorkspaceStats(agentId: string): WorkspaceStats {
  return readJson<WorkspaceStats>(`${STATS_PREFIX}${agentId}`, {
    messagesSent: 0,
    runsCompleted: 0,
    lastActiveAt: null,
  });
}

export function bumpWorkspaceStats(
  agentId: string,
  patch: Partial<WorkspaceStats>
): WorkspaceStats {
  const current = loadWorkspaceStats(agentId);
  const next = {
    ...current,
    ...patch,
    lastActiveAt: patch.lastActiveAt ?? new Date().toISOString(),
  };
  writeJson(`${STATS_PREFIX}${agentId}`, next);
  return next;
}
