import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import type { AgentActionItem } from "@/lib/agents/load-agent-setup-config";

interface AgentActionsConfigCardProps {
  agentId: string;
  actions: AgentActionItem[];
  hasActions: boolean;
}

export default function AgentActionsConfigCard({
  agentId,
  actions,
  hasActions,
}: AgentActionsConfigCardProps) {
  const configureHref = `/agents/${encodeURIComponent(agentId)}/setup?wizard=1`;

  return (
    <section className="asp-card asp-actions-config" aria-labelledby="asp-actions-heading">
      <div className="asp-actions-head">
        <div>
          <h2 id="asp-actions-heading" className="asp-card-title">
            Configured actions &amp; tools
          </h2>
          <p className="asp-card-subtitle">
            Actions this agent is allowed to request through Wave.
          </p>
        </div>
        {hasActions ? (
          <Link href={configureHref} className="asp-actions-add-btn">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add action
          </Link>
        ) : null}
      </div>

      {hasActions ? (
        <ul className="asp-actions-list">
          {actions.map((action) => (
            <li key={`${action.source}-${action.id}`} className="asp-actions-item">
              <Wrench className="h-4 w-4 asp-actions-icon" strokeWidth={2} aria-hidden="true" />
              <span>{action.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="asp-actions-empty">
          <p className="asp-actions-empty-title">No actions configured yet</p>
          <p className="asp-actions-empty-desc">
            Define what this agent can do before connecting it to your systems.
          </p>
          <Link href={configureHref} className="asp-actions-add-btn asp-actions-add-btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add action
          </Link>
        </div>
      )}
    </section>
  );
}
