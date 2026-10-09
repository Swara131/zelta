"use client";

import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { buildAgentCards, isDemoAgent } from "@/lib/dashboard/founder-copy";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import AgentTrustTooltip from "@/components/trust/AgentTrustTooltip";

interface OverviewYourAgentsSectionProps {
  keys: AgentApiKeyRecord[];
  approvals: PendingApproval[];
  auditEntries: AuditTimelineEntry[];
}

function agentStatusLabel(agentId: string, key: AgentApiKeyRecord | undefined): string {
  const lifecycle = loadAgentLifecycle(agentId);

  if (lifecycle.activated && lifecycle.testActionPassed) {
    return "Protected";
  }

  if (key?.lastUsedAt) {
    return "Connected";
  }

  if (lifecycle.protectionConfigured) {
    return "Setup in progress";
  }

  return "Not connected";
}

export default function OverviewYourAgentsSection({
  keys,
  approvals,
  auditEntries,
}: OverviewYourAgentsSectionProps) {
  const agents = buildAgentCards(keys, approvals, auditEntries).filter(
    (agent) => !isDemoAgent(agent)
  );

  if (agents.length === 0) {
    return null;
  }

  const keysByAgent = new Map(
    keys.filter((key) => !key.revokedAt).map((key) => [key.agentId, key])
  );

  return (
    <section className="cc-section" aria-labelledby="cc-your-agents-heading">
      <div className="cc-section-header-row">
        <h2 id="cc-your-agents-heading" className="cc-section-kicker">
          Your Agents
        </h2>
        <Link href="/integrations" className="cc-section-link">
          View all
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      <ul className="cc-agents-grid">
        {agents.map((agent) => {
          const key = keysByAgent.get(agent.id);
          const status = agentStatusLabel(agent.id, key);
          const href = `/agents/${encodeURIComponent(agent.id)}/setup`;

          return (
            <li key={agent.id}>
              <AgentTrustTooltip>
                <Link href={href} className="cc-agent-card ds-panel">
                <span className="cc-agent-card-icon" aria-hidden="true">
                  <Bot className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="cc-agent-card-body">
                  <span className="cc-agent-card-name">{agent.name}</span>
                  <span className="cc-agent-card-meta">
                    {status}
                    {agent.pendingApprovals > 0
                      ? ` · ${agent.pendingApprovals} awaiting approval`
                      : ""}
                  </span>
                </span>
                <ArrowRight
                  className="cc-agent-card-arrow h-4 w-4 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
              </AgentTrustTooltip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
