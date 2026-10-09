"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Plus } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

async function fetchAgents(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  if (!response.ok) return [];
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[] };
  return payload.keys ?? [];
}

export default function AgentsIndexPage() {
  const [agents, setAgents] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setAgents(await fetchAgents());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell maxWidth="6xl">
      <header className="zhome-header">
        <div>
          <h1 className="ds-page-title">Agents</h1>
          <p className="ds-page-description">
            Create and manage the agents Wave runs for you.
          </p>
        </div>
        <Link href="/agents/create" className="ds-btn ds-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Agent
        </Link>
      </header>

      {loading ? (
        <p className="zhome-loading-inline">
          <Loader2 className="h-4 w-4 animate-spin inline" aria-hidden="true" /> Loading…
        </p>
      ) : agents.filter((key) => !key.revokedAt).length === 0 ? (
        <section className="zhome-empty ds-panel">
          <h2>No agents yet</h2>
          <p>Create your first agent to get started.</p>
          <Link href="/agents/create" className="ds-btn ds-btn-primary">
            Create Agent
          </Link>
        </section>
      ) : (
        <ul className="zhome-agent-grid">
          {agents
            .filter((key) => !key.revokedAt)
            .map((key) => (
              <li key={key.id}>
                <Link
                  href={`/agents/${encodeURIComponent(key.agentId)}`}
                  className="zhome-agent-card ds-panel"
                >
                  <Bot className="h-5 w-5" aria-hidden="true" />
                  <span className="zhome-agent-name">{key.name || key.agentId}</span>
                  <span className="zhome-agent-meta">View agent →</span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </PageShell>
  );
}
