"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { AgentCreatedToast } from "@/components/agent-builder/AgentBuilderModal";
import WorkflowStep from "@/components/agents/workflow/WorkflowStep";

interface AgentPayload {
  name: string;
  description: string | null;
  goal: string | null;
  tools: string[];
  displayStatus: string;
  suggestedThreshold: number | null;
}

function formatThreshold(value: number | null | undefined): string {
  if (value == null) return "₹5,000";
  return `₹${value.toLocaleString("en-IN")}`;
}

function statusEmoji(displayStatus: string): string {
  const normalized = displayStatus.toLowerCase();
  if (normalized.includes("ready") || normalized.includes("active")) return "🟢";
  if (normalized.includes("draft")) return "🟡";
  return "🟢";
}

export default function AgentWorkflowPage() {
  const params = useParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const [agent, setAgent] = useState<AgentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      setError("Agent not found.");
      return;
    }

    void fetch(`/api/v1/agents/${encodeURIComponent(agentId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          agent?: AgentPayload;
          error?: string;
        };
        if (!response.ok || !payload.agent) {
          throw new Error(payload.error ?? "Could not load agent.");
        }
        setAgent(payload.agent);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load agent.");
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  const description = useMemo(() => {
    if (!agent) return "";
    return agent.description ?? agent.goal ?? "Your agent is configured and ready.";
  }, [agent]);

  const toolsLabel = useMemo(() => {
    if (!agent?.tools?.length) return "—";
    return agent.tools.join(", ");
  }, [agent]);

  if (loading) {
    return (
      <PageShell maxWidth="6xl" className="awf-page">
        <p className="awf-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading workflow…
        </p>
      </PageShell>
    );
  }

  if (error || !agent) {
    return (
      <PageShell maxWidth="6xl" className="awf-page">
        <p className="awf-error" role="alert">
          {error ?? "Agent not found."}
        </p>
        <Link href="/integrations" className="awf-btn awf-btn-secondary">
          ← Back to My Agents
        </Link>
      </PageShell>
    );
  }

  const threshold = formatThreshold(agent.suggestedThreshold);

  return (
    <PageShell maxWidth="6xl" className="awf-page">
      <header className="awf-banner">
        <p className="awf-banner-kicker">🎉 Your agent is ready</p>
        <h1 className="awf-banner-title">Here&apos;s what your agent will do:</h1>
        <p className="awf-banner-name">{agent.name}</p>
      </header>

      <section className="awf-section" aria-labelledby="awf-primary-heading">
        <h2 id="awf-primary-heading" className="awf-section-title">
          Protection flow
        </h2>
        <div className="awf-flow awf-flow-primary">
          <WorkflowStep icon="👤" title="User" tone="blue" index={0} />
          <WorkflowStep
            icon="🤖"
            title="Agent proposes action"
            tone="blue"
            index={1}
          />
          <WorkflowStep
            icon="🧠"
            title="Wave Gateway"
            description="Policy Check + Risk Analysis"
            tone="purple"
            index={2}
          />
          <WorkflowStep
            icon="📊"
            title="Risk Score: 0.45 (LOW)"
            tone="green"
            index={3}
          />
          <WorkflowStep
            icon="✓"
            title="Decision: AUTO-APPROVED"
            tone="success"
            index={4}
            checkmark
          />
          <WorkflowStep icon="⚡" title="Action Executed" tone="green" index={5} />
          <WorkflowStep
            icon="📝"
            title="Logged in Audit Trail"
            tone="neutral"
            index={6}
            showArrow={false}
          />
        </div>
      </section>

      <section className="awf-section" aria-labelledby="awf-paths-heading">
        <h2 id="awf-paths-heading" className="awf-section-title">
          Same agent, two protection paths
        </h2>
        <p className="awf-section-lead">
          Wave automatically routes actions based on risk — low-risk actions run instantly,
          high-risk actions wait for your approval.
        </p>

        <div className="awf-dual-grid">
          <div className="awf-path awf-path-high">
            <h3 className="awf-path-label">High risk path</h3>
            <WorkflowStep icon="🤖" title="Agent proposes action" tone="blue" index={0} />
            <WorkflowStep
              icon="🧠"
              title="Wave Gateway"
              lines={["Risk Score: 0.82 (HIGH)"]}
              tone="purple"
              index={1}
              pulse
            />
            <WorkflowStep
              icon="⚠️"
              title="Decision: NEEDS APPROVAL"
              tone="warning"
              index={2}
            />
            <WorkflowStep
              icon="👤"
              title="You get notified"
              description="Email + WhatsApp + Dashboard"
              tone="orange"
              index={3}
            />
            <WorkflowStep
              icon="✋"
              title="You approve or reject"
              tone="orange"
              index={4}
            />
            <WorkflowStep
              icon="⚡"
              title="Action executes OR blocked"
              tone="neutral"
              index={5}
            />
            <WorkflowStep
              icon="📝"
              title="Logged in Audit Trail"
              tone="neutral"
              index={6}
              showArrow={false}
            />
          </div>

          <div className="awf-path awf-path-low">
            <h3 className="awf-path-label">Low risk path</h3>
            <WorkflowStep icon="🤖" title="Agent proposes action" tone="blue" index={0} />
            <WorkflowStep
              icon="🧠"
              title="Wave Gateway"
              lines={["Risk Score: 0.15 (LOW)"]}
              tone="purple"
              index={1}
            />
            <WorkflowStep
              icon="✓"
              title="Decision: AUTO-APPROVED"
              tone="success"
              index={2}
              checkmark
            />
            <WorkflowStep
              icon="⚡"
              title="Action executes immediately"
              tone="green"
              index={3}
            />
            <WorkflowStep
              icon="📝"
              title="Logged in Audit Trail"
              tone="neutral"
              index={4}
              showArrow={false}
            />
          </div>
        </div>
      </section>

      <section className="awf-details ds-panel" aria-labelledby="awf-details-heading">
        <h2 id="awf-details-heading" className="awf-details-title">
          Your agent details:
        </h2>
        <dl className="awf-details-grid">
          <div>
            <dt>Agent Name</dt>
            <dd>{agent.name}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{description}</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>{toolsLabel}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {statusEmoji(agent.displayStatus)} {agent.displayStatus || "Ready"}
            </dd>
          </div>
          <div>
            <dt>Risk Threshold</dt>
            <dd>{threshold}</dd>
          </div>
        </dl>
      </section>

      <footer className="awf-footer">
        <Link href="/integrations" className="awf-btn awf-btn-secondary">
          ← Back to My Agents
        </Link>
        <Link
          href={`/agents/${encodeURIComponent(agentId)}/setup`}
          className="awf-btn awf-btn-primary"
        >
          Next: Set up protection →
        </Link>
      </footer>

      <AgentCreatedToast />
    </PageShell>
  );
}
