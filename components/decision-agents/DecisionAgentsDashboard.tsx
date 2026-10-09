"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { DECISION_AGENT_TEMPLATES, type DecisionAgentRecord } from "@/lib/decision-agents/types";

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DecisionAgentsDashboard() {
  const [agents, setAgents] = useState<DecisionAgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployingSlug, setDeployingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/decision-agents");
      const payload = (await response.json()) as {
        agents?: DecisionAgentRecord[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Failed to load decision agents.");
      setAgents(payload.agents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeploy = async (slug: string) => {
    setDeployingSlug(slug);
    try {
      const response = await fetch(
        `/api/v1/decision-agents/${encodeURIComponent(slug)}/deploy`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Deploy failed.");
      }
      await load();
    } catch {
      // refresh will show current state
      await load();
    } finally {
      setDeployingSlug(null);
    }
  };

  return (
    <PageShell maxWidth="7xl" className="zdec-page">
      <header className="zdec-header">
        <div>
          <h1>Multiple Decision Agents</h1>
          <p>
            Create AI agents that make decisions based on your rules, context, and risk policies.
          </p>
        </div>
        <div className="zdec-header-actions">
          <Link href="/decision-agents/create" className="zplat-btn zplat-btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Decision Agent
          </Link>
          <Link href="/decision-agents/templates" className="zplat-btn zplat-btn-secondary">
            Templates
          </Link>
        </div>
      </header>

      <div className="zdec-pipeline" aria-label="Multi-agent flow">
        <span>Agent 1</span>
        <span className="zdec-pipeline-arrow" aria-hidden="true">→</span>
        <span>Agent 2</span>
        <span className="zdec-pipeline-arrow" aria-hidden="true">→</span>
        <span className="zdec-pipeline-decision">Decision</span>
        <span className="zdec-pipeline-arrow" aria-hidden="true">→</span>
        <span>Agent 3</span>
      </div>

      {loading ? (
        <p className="zplat-loading"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</p>
      ) : error ? (
        <section className="zdec-migration-panel ds-panel" role="alert">
          <p className="zplat-error">{error}</p>
          {/decision_agents|schema cache/i.test(error) ? (
            <div className="zdec-migration-steps">
              <p className="zdec-migration-title">One-time database setup</p>
              <ol>
                <li>
                  Open{" "}
                  <a
                    href="https://supabase.com/dashboard/project/_/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase → SQL Editor
                  </a>
                </li>
                <li>
                  Paste and run{" "}
                  <code>supabase/migrations/20260925180000_decision_agents.sql</code>
                </li>
                <li>Refresh this page</li>
              </ol>
            </div>
          ) : null}
        </section>
      ) : agents.length === 0 ? (
        <section className="zdec-templates ds-panel">
          <div className="zdec-section-head">
            <h2>Get started</h2>
            <p className="zdec-lead">
              Start from a template, then connect agents into a decision flow.
            </p>
          </div>
          <ul className="zdec-template-grid">
            {DECISION_AGENT_TEMPLATES.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/decision-agents/create?template=${template.id}`}
                  className="zdec-template-card"
                >
                  <h3>{template.name}</h3>
                  <p>{template.purpose}</p>
                  <span className="zdec-template-cta">Use template</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ul className="zdec-agent-grid">
          {agents.map((agent) => (
            <li key={agent.id}>
              <article className="zdec-agent-card ds-panel">
                <div className="zdec-card-top">
                  <h2>{agent.name}</h2>
                  <Link
                    href={`/decision-agents/${encodeURIComponent(agent.slug)}`}
                    className="zdec-more-btn"
                    aria-label={`Edit ${agent.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Link>
                </div>
                <p className="zdec-card-purpose">{agent.purpose}</p>
                <p className="zdec-meta">
                  <span>Status: {agent.status}</span>
                  <span>Risk: {agent.config.riskLevel ?? "medium"}</span>
                  <span>Updated: {formatUpdated(agent.updatedAt)}</span>
                </p>
                <div className="zdec-card-actions">
                  <Link
                    href={`/decision-agents/${encodeURIComponent(agent.slug)}/test`}
                    className="zplat-btn zplat-btn-secondary"
                  >
                    Test
                  </Link>
                  <button
                    type="button"
                    className="zplat-btn zplat-btn-ghost"
                    disabled={agent.status === "deployed" || deployingSlug === agent.slug}
                    onClick={() => void handleDeploy(agent.slug)}
                  >
                    {deployingSlug === agent.slug ? "Deploying…" : "Deploy"}
                  </button>
                  <Link
                    href={`/decision-agents/${encodeURIComponent(agent.slug)}`}
                    className="zplat-btn zplat-btn-ghost"
                  >
                    Edit
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
