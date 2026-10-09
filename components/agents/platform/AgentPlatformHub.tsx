"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, FlaskConical, Plus, Plug, Rocket } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatusBadge from "@/components/ui/StatusBadge";
import ConnectAgentPanel from "@/components/agents/platform/ConnectAgentPanel";
import TestAgentPanel from "@/components/agents/platform/TestAgentPanel";
import DeployExistingAgentPanel from "@/components/agents/platform/DeployExistingAgentPanel";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

type SubPanel = "connect" | "test" | "deploy" | null;

async function fetchKeys(): Promise<AgentApiKeyRecord[]> {
  const res = await fetch("/api/gateway/keys");
  if (!res.ok) return [];
  const payload = (await res.json()) as { keys?: AgentApiKeyRecord[] };
  return (payload.keys ?? []).filter((key) => !key.revokedAt);
}

export default function AgentPlatformHub() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subPanel, setSubPanel] = useState<SubPanel>(
    searchParams.get("connect") === "1"
      ? "connect"
      : searchParams.get("test") === "1"
        ? "test"
        : null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setAgents(await fetchKeys());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPanel = (panel: SubPanel) => {
    setSubPanel((current) => (current === panel ? null : panel));
  };

  return (
    <PageShell maxWidth="7xl" className="zplat-page">
      <header className="zplat-header zplat-header-minimal">
        <div>
          <h1 className="zplat-title">Agents</h1>
          <p className="zplat-lead">
            Create agents in Wave, or connect, test, and deploy agents built elsewhere.
          </p>
        </div>

        <div className="zplat-action-stack">
          <div className="zplat-action-primary">
            <Link href="/agents/create" className="zplat-btn zplat-btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Agent
            </Link>
            <Link href="/dashboard/templates" className="zplat-btn zplat-btn-secondary">
              Start from template
            </Link>
            <button
              type="button"
              className={`zplat-btn zplat-btn-secondary${subPanel === "connect" ? " zplat-btn-active" : ""}`}
              aria-pressed={subPanel === "connect"}
              onClick={() => openPanel("connect")}
            >
              <Plug className="h-4 w-4" aria-hidden="true" />
              Connect Agent
            </button>
          </div>
          <div className="zplat-action-secondary">
            <button
              type="button"
              className={`zplat-btn zplat-btn-outline${subPanel === "test" ? " zplat-btn-active" : ""}`}
              aria-pressed={subPanel === "test"}
              onClick={() => openPanel("test")}
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Test an Agent
            </button>
            <button
              type="button"
              className={`zplat-btn zplat-btn-outline${subPanel === "deploy" ? " zplat-btn-active" : ""}`}
              aria-pressed={subPanel === "deploy"}
              onClick={() => openPanel("deploy")}
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Deploy Existing Agent
            </button>
          </div>
          <p className="zplat-action-helper">
            Test an agent before deployment, or deploy an agent you&apos;ve already built.
          </p>
        </div>
      </header>

      {subPanel === "connect" ? (
        <ConnectAgentPanel onClose={() => setSubPanel(null)} />
      ) : null}
      {subPanel === "test" ? <TestAgentPanel onClose={() => setSubPanel(null)} /> : null}
      {subPanel === "deploy" ? (
        <DeployExistingAgentPanel onClose={() => setSubPanel(null)} />
      ) : null}

      {loading ? (
        <Skeleton lines={4} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Build your first AI agent with Wave, or connect one from another platform."
          primaryAction={{ label: "Create Agent", href: "/agents/create" }}
          secondaryAction={{ label: "Use a template", href: "/templates" }}
        />
      ) : (
        <ul className="zplat-agent-list">
          {agents.map((key) => (
            <li key={key.id} className="zplat-agent-card ds-panel">
              <div>
                <h2>{key.name || key.agentId}</h2>
                <p className="zplat-agent-id">{key.agentId}</p>
                <StatusBadge tone={key.revokedAt ? "danger" : "success"}>
                  {key.revokedAt ? "Revoked" : "Protected"}
                </StatusBadge>
              </div>
              <div className="zplat-agent-actions">
                <Link
                  href={`/agents/${encodeURIComponent(key.agentId)}`}
                  className="zplat-btn zplat-btn-ghost"
                >
                  Open
                </Link>
                <Link
                  href={`/agents/${encodeURIComponent(key.agentId)}/test`}
                  className="zplat-btn zplat-btn-ghost"
                >
                  Test
                </Link>
                <Link
                  href={`/agents/${encodeURIComponent(key.agentId)}/deploy`}
                  className="zplat-btn zplat-btn-ghost"
                >
                  Deploy
                </Link>
                <Link
                  href={`/agents/${encodeURIComponent(key.agentId)}/edit`}
                  className="zplat-btn zplat-btn-ghost"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
