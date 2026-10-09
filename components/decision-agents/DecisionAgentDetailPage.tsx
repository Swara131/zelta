"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import AgentRequirementsList from "@/components/agents/setup/AgentRequirementsList";
import { getAgentRequirements } from "@/lib/agents/requirements/engine";
import { snapshotFromDecisionAgent } from "@/lib/agents/requirements/from-decision";
import type { DecisionAgentRecord } from "@/lib/decision-agents/types";

export default function DecisionAgentDetailPage() {
  const params = useParams();
  const slug = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const [agent, setAgent] = useState<DecisionAgentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const response = await fetch(`/api/v1/decision-agents/${encodeURIComponent(slug)}`);
    const payload = (await response.json()) as { agent?: DecisionAgentRecord };
    setAgent(payload.agent ?? null);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <PageShell maxWidth="6xl" className="zdec-page">
        <p className="zplat-loading"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</p>
      </PageShell>
    );
  }

  if (!agent) {
    return (
      <PageShell maxWidth="6xl" className="zdec-page">
        <p>Decision agent not found.</p>
      </PageShell>
    );
  }

  const agentName = agent.name;
  const requirements = getAgentRequirements(snapshotFromDecisionAgent(agent));

  return (
    <PageShell maxWidth="6xl" className="zdec-page">
      <header className="zdec-header">
        <div>
          <h1>{agentName}</h1>
          <p>{agent.purpose}</p>
        </div>
        <Link href={`/decision-agents/${encodeURIComponent(slug)}/test`} className="zplat-btn zplat-btn-primary">
          Test Agent
        </Link>
      </header>

      <AgentRequirementsList result={requirements} testHref={`/decision-agents/${encodeURIComponent(slug)}/test`} />

      <div className="zdec-detail-grid">
        <section className="ds-panel">
          <h2>Decision workflow</h2>
          <ol className="zdec-workflow">
            {agent.config.workflow.map((node) => (
              <li key={node.id}>
                <article className="zdec-workflow-node">
                  <strong>{node.name}</strong>
                  <p>{node.description}</p>
                </article>
                <span className="zdec-connector" aria-hidden="true">↓</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="ds-panel">
          <h2>Policy rules</h2>
          <ul className="zdec-rules">
            {agent.config.rules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.label}</strong>
                <code>{rule.expression}</code>
                <span>→ {rule.outcome.toUpperCase()}</span>
                {rule.isAiGenerated ? <small>AI-generated starter rule — edit before production</small> : null}
              </li>
            ))}
          </ul>
          <h3>Approval when</h3>
          <p>{agent.config.approvalWhen}</p>
        </section>
      </div>
    </PageShell>
  );
}
