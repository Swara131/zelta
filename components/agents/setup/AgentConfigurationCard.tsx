import type { AgentSetupConfig } from "@/lib/agents/load-agent-setup-config";

interface AgentConfigurationCardProps {
  config: AgentSetupConfig;
}

export default function AgentConfigurationCard({ config }: AgentConfigurationCardProps) {
  return (
    <section className="asp-card asp-config" aria-labelledby="asp-config-heading">
      <h2 id="asp-config-heading" className="asp-card-title">
        Agent configuration
      </h2>
      <p className="asp-card-subtitle">
        Live settings for this agent — loaded from your workspace using agent ID{" "}
        <code className="asp-inline-code">{config.agentId}</code>.
      </p>

      <dl className="asp-config-grid">
        <div className="asp-config-field asp-config-field-wide">
          <dt>Purpose</dt>
          <dd>{config.purpose || "No purpose configured yet."}</dd>
        </div>
        <div className="asp-config-field asp-config-field-wide">
          <dt>Description</dt>
          <dd>{config.description || "No description provided."}</dd>
        </div>
        <div className="asp-config-field">
          <dt>Agent name</dt>
          <dd>{config.name}</dd>
        </div>
        <div className="asp-config-field">
          <dt>Agent type</dt>
          <dd>{config.agentType}</dd>
        </div>
        {config.templateName ? (
          <div className="asp-config-field asp-config-field-wide">
            <dt>Template</dt>
            <dd>Created from: {config.templateName} template</dd>
          </div>
        ) : null}
        <div className="asp-config-field">
          <dt>Trigger</dt>
          <dd>{config.triggerLabel}</dd>
        </div>
        <div className="asp-config-field">
          <dt>Status</dt>
          <dd>
            {config.isLive ? (
              <span className="asp-status-live">Live &amp; Protected</span>
            ) : (
              config.statusLabel
            )}
          </dd>
        </div>
        <div className="asp-config-field">
          <dt>Connection</dt>
          <dd>
            {config.connection.connected ? (
              <>
                Connected
                {config.connection.keyPrefix ? (
                  <span className="asp-config-muted">
                    {" "}
                    · Key prefix {config.connection.keyPrefix}…
                  </span>
                ) : null}
              </>
            ) : (
              config.connection.label
            )}
          </dd>
        </div>
        <div className="asp-config-field">
          <dt>Created</dt>
          <dd>{config.createdAt}</dd>
        </div>
        <div className="asp-config-field">
          <dt>Auto-approve threshold</dt>
          <dd>
            {config.protection.thresholdInr != null
              ? `₹${config.protection.thresholdInr.toLocaleString("en-IN")}`
              : "Not set"}
          </dd>
        </div>
        <div className="asp-config-field">
          <dt>Low-risk auto-allow</dt>
          <dd>{config.protection.autoAllowLowRisk ? "Enabled" : "Disabled"}</dd>
        </div>
      </dl>
    </section>
  );
}
