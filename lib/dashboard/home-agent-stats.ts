import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function resolveAgentId(entry: AuditTimelineEntry): string | null {
  const fromMeta =
    typeof entry.metadata?.agentId === "string" ? entry.metadata.agentId : null;
  const actor = entry.actor?.trim();
  if (fromMeta) return fromMeta;
  if (actor && actor !== "Gateway") return actor;
  return null;
}

export function countProtectedAgents(keys: AgentApiKeyRecord[]): number {
  return keys.filter((key) => {
    if (key.revokedAt) return false;
    const lifecycle = loadAgentLifecycle(key.agentId);
    return (
      lifecycle.protectionConfigured ||
      lifecycle.activated ||
      lifecycle.launched ||
      Boolean(key.lastUsedAt)
    );
  }).length;
}

export function isAgentLive(agentId: string, key: AgentApiKeyRecord): boolean {
  const lifecycle = loadAgentLifecycle(agentId);
  return (
    lifecycle.activated ||
    lifecycle.launched ||
    lifecycle.testActionPassed ||
    Boolean(key.lastUsedAt)
  );
}

export function getLastActionIso(
  agentId: string,
  auditEntries: AuditTimelineEntry[],
  key: AgentApiKeyRecord
): string | null {
  let latest: string | null = key.lastUsedAt;

  for (const entry of auditEntries) {
    if (resolveAgentId(entry) !== agentId) continue;
    if (!latest || entry.timestamp > latest) {
      latest = entry.timestamp;
    }
  }

  return latest;
}

export function countActionsThisMonth(
  agentId: string,
  auditEntries: AuditTimelineEntry[],
  now = Date.now()
): number {
  const cutoff = now - THIRTY_DAYS_MS;

  return auditEntries.filter((entry) => {
    if (resolveAgentId(entry) !== agentId) return false;
    const ts = Date.parse(entry.timestamp);
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}
