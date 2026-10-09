interface AgentDetailsCardProps {
  name: string;
  agentType: string;
  statusLabel: string;
  createdAt: string;
  isLive: boolean;
}

export default function AgentDetailsCard({
  name,
  agentType,
  statusLabel,
  createdAt,
  isLive,
}: AgentDetailsCardProps) {
  return (
    <section className="asp-card asp-details" aria-labelledby="asp-details-heading">
      <h2 id="asp-details-heading" className="asp-card-title">
        Agent Details
      </h2>
      <dl className="asp-details-grid">
        <div className="asp-details-field">
          <dt>Agent name</dt>
          <dd>{name}</dd>
        </div>
        <div className="asp-details-field">
          <dt>Agent type</dt>
          <dd>{agentType}</dd>
        </div>
        <div className="asp-details-field">
          <dt>Status</dt>
          <dd>{isLive ? "🟢 Live & Protected" : statusLabel}</dd>
        </div>
        <div className="asp-details-field">
          <dt>Created</dt>
          <dd>{createdAt}</dd>
        </div>
      </dl>
    </section>
  );
}
