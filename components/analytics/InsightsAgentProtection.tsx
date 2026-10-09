"use client";

import type { AgentProtectionRow } from "@/lib/analytics/founder-insights";

interface InsightsAgentProtectionProps {
  agents: AgentProtectionRow[];
}

export default function InsightsAgentProtection({ agents }: InsightsAgentProtectionProps) {
  if (agents.length === 0) {
    return (
      <p className="ins-empty-inline">
        No agent activity recorded yet. Connect an agent to see protection stats here.
      </p>
    );
  }

  return (
    <div className="ins-table-wrap">
      <table className="ins-table ins-agent-table">
        <thead>
          <tr>
            <th scope="col">
              Agent name
              <span className="ins-col-help">The agent Wave is protecting</span>
            </th>
            <th scope="col">
              Actions checked
              <span className="ins-col-help">Actions Wave evaluated before they ran</span>
            </th>
            <th scope="col">
              Approval rate
              <span className="ins-col-help">How often this agent needed your sign-off</span>
            </th>
            <th scope="col">
              Blocked actions
              <span className="ins-col-help">Attempts Wave stopped for this agent</span>
            </th>
            <th scope="col">
              Protection status
              <span className="ins-col-help">Whether Wave is actively guarding this agent</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.agentId}>
              <td>
                <span className="ins-agent-name">{agent.agentName}</span>
              </td>
              <td>
                <span className="ins-cell-value">{agent.actionsChecked}</span>
                <span className="ins-cell-help">{agent.explanations.actionsChecked}</span>
              </td>
              <td>
                <span className="ins-cell-value">{agent.approvalRate}</span>
                <span className="ins-cell-help">{agent.explanations.approvalRate}</span>
              </td>
              <td>
                <span className="ins-cell-value">{agent.blockedActions}</span>
                <span className="ins-cell-help">{agent.explanations.blockedActions}</span>
              </td>
              <td>
                <span className="ins-cell-value">{agent.protectionStatus}</span>
                <span className="ins-cell-help">{agent.explanations.protectionStatus}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
