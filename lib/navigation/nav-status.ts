import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";

export interface NavStatusSnapshot {
  agentCount: number;
  pendingApprovals: number;
  protectionLabel: string | null;
}

export function computeNavStatus(
  keys: AgentApiKeyRecord[],
  approvals: PendingApproval[],
  protectionConfigured: boolean
): NavStatusSnapshot {
  const agentCount = keys.filter((key) => !key.revokedAt).length;
  const pendingApprovals = approvals.length;

  let protectionLabel: string | null = null;
  if (agentCount > 0) {
    protectionLabel = protectionConfigured ? "Protected" : "Setup";
  }

  return {
    agentCount,
    pendingApprovals,
    protectionLabel,
  };
}

export function formatNavBadge(
  navId: string,
  status: NavStatusSnapshot
): string | null {
  switch (navId) {
    case "agents":
      return status.agentCount > 0 ? String(status.agentCount) : null;
    case "approvals":
      return status.pendingApprovals > 0
        ? `${status.pendingApprovals} pending`
        : null;
    case "protection":
      return status.protectionLabel;
    default:
      return null;
  }
}
