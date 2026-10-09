"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { AgentActionActivity } from "@/lib/audit/agent-actions";

interface RecentAgentActivitySectionProps {
  actions: AgentActionActivity[];
  loading: boolean;
}

function agentInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function statusBadgeClass(status: AgentActionActivity["status"]): string {
  switch (status) {
    case "executed":
      return "cc-agent-action-badge cc-agent-action-badge-executed";
    case "pending":
      return "cc-agent-action-badge cc-agent-action-badge-pending";
    case "blocked":
      return "cc-agent-action-badge cc-agent-action-badge-blocked";
    default:
      return "cc-agent-action-badge";
  }
}

export default function RecentAgentActivitySection({
  actions,
  loading,
}: RecentAgentActivitySectionProps) {
  if (loading) {
    return (
      <section className="cc-section" aria-labelledby="cc-recent-heading" aria-busy="true">
        <h2 id="cc-recent-heading" className="cc-section-kicker">
          Recent activity
        </h2>
        <div className="cc-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading activity…
        </div>
      </section>
    );
  }

  if (actions.length === 0) {
    return (
      <section className="cc-section" aria-labelledby="cc-recent-empty-heading">
        <p id="cc-recent-empty-heading" className="cc-agent-action-empty">
          No agent actions yet. Create an agent and run an action to see it here.
        </p>
      </section>
    );
  }

  return (
    <section className="cc-section" aria-labelledby="cc-recent-heading">
      <div className="cc-section-head">
        <div>
          <h2 id="cc-recent-heading" className="cc-section-kicker">
            Recent activity
          </h2>
          <p className="cc-section-desc">
            What your agents tried to do — and what Wave decided.
          </p>
        </div>
      </div>

      <ul className="cc-agent-action-list">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              href="/audit?type=agent_action"
              className="cc-agent-action-row ds-panel"
            >
              <span
                className="cc-agent-action-avatar"
                aria-hidden="true"
                title={action.agentName}
              >
                {agentInitial(action.agentName)}
              </span>

              <div className="cc-agent-action-body">
                <p className="cc-agent-action-summary">{action.summary}</p>
                <div className="cc-agent-action-meta">
                  <span className={statusBadgeClass(action.status)}>
                    {action.statusLabel}
                  </span>
                  {action.isSimulated ? (
                    <span className="cc-activity-demo">Sample</span>
                  ) : null}
                  <span className="cc-agent-action-time">{action.relativeTime}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="cc-agent-action-footer">
        <Link href="/audit?type=agent_action" className="fd-link">
          View full log →
        </Link>
      </div>
    </section>
  );
}
