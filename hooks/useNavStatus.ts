"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import { computeNavStatus, type NavStatusSnapshot } from "@/lib/navigation/nav-status";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";

const EMPTY: NavStatusSnapshot = {
  agentCount: 0,
  pendingApprovals: 0,
  protectionLabel: null,
};

function anyAgentProtected(keys: AgentApiKeyRecord[]): boolean {
  return keys
    .filter((key) => !key.revokedAt)
    .some((key) => {
      const lifecycle = loadAgentLifecycle(key.agentId);
      return lifecycle.activated && lifecycle.protectionConfigured;
    });
}

export function useNavStatus(): NavStatusSnapshot {
  const [status, setStatus] = useState<NavStatusSnapshot>(EMPTY);

  const load = useCallback(async () => {
    try {
      const [keysRes, approvalsRes] = await Promise.all([
        fetch("/api/gateway/keys"),
        fetch("/api/approvals"),
      ]);

      let keys: AgentApiKeyRecord[] = [];
      let approvals: PendingApproval[] = [];

      if (keysRes.ok) {
        const payload = (await keysRes.json()) as { keys?: AgentApiKeyRecord[] };
        keys = payload.keys ?? [];
      }

      if (approvalsRes.ok) {
        const payload = (await approvalsRes.json()) as { approvals?: PendingApproval[] };
        approvals = payload.approvals ?? [];
      }

      setStatus(
        computeNavStatus(keys, approvals, anyAgentProtected(keys))
      );
    } catch {
      setStatus(EMPTY);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return status;
}
