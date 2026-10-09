import type { SecurityOverviewMetrics } from "@/lib/integrations/agent-trust-metrics";

interface AgentsSecurityOverviewProps {
  metrics: SecurityOverviewMetrics;
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

export default function AgentsSecurityOverview({ metrics }: AgentsSecurityOverviewProps) {
  return (
    <section className="ma-security-overview ds-panel" aria-labelledby="ma-security-heading">
      <div className="ma-security-overview-head">
        <h2 id="ma-security-heading" className="ma-security-overview-title">
          Security Overview
        </h2>
        {metrics.isSimulated ? (
          <span className="ma-security-sample-tag">Sample metrics</span>
        ) : null}
      </div>
      <p className="ma-security-overview-desc">
        Wave is actively reviewing agent actions and blocking risky ones before they run.
      </p>

      <dl className="ma-security-stats">
        <div className="ma-security-stat">
          <dt>Total actions reviewed</dt>
          <dd>{metrics.totalActionsReviewed.toLocaleString()}</dd>
        </div>
        <div className="ma-security-stat ma-security-stat-block">
          <dt>Blocked risky actions</dt>
          <dd>{metrics.blockedRiskyActions.toLocaleString()}</dd>
        </div>
        <div className="ma-security-stat ma-security-stat-approval">
          <dt>Human approval rate</dt>
          <dd>{formatRate(metrics.humanApprovalRate)}</dd>
        </div>
      </dl>
    </section>
  );
}
