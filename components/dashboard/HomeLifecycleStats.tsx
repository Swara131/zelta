import Link from "next/link";

export interface HomeLifecycleStatsData {
  needsAttention: number;
  readyToDeploy: number;
  running: number;
  pendingApprovals: number;
  safetyEvents: number;
  /** Alias used by GET /api/monitor/dashboard (`stats.activeAgents`). */
  activeAgents?: number;
  agents?: number;
  protectedAgents?: number;
}

interface HomeLifecycleStatsProps {
  stats: HomeLifecycleStatsData | null;
  loading?: boolean;
}

export default function HomeLifecycleStats({ stats, loading }: HomeLifecycleStatsProps) {
  if (loading || !stats) {
    return (
      <section className="zhome-lifecycle" aria-hidden="true">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="zhome-lifecycle-card zhome-lifecycle-skeleton">
            <span>—</span>
            <p>Loading</p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="zhome-lifecycle" aria-label="Platform overview">
        <Link href="/agents/platform" className="zhome-lifecycle-card">
          <span>{stats.agents ?? stats.readyToDeploy}</span>
          <p>Agents</p>
        </Link>
        <Link href="/monitor" className="zhome-lifecycle-card">
          <span>{stats.running}</span>
          <p>Running</p>
        </Link>
        <Link href="/monitor" className="zhome-lifecycle-card">
          <span>{stats.needsAttention}</span>
          <p>Needs attention</p>
        </Link>
        <Link href="/safety" className="zhome-lifecycle-card">
          <span>{stats.protectedAgents ?? stats.safetyEvents}</span>
          <p>Protected</p>
        </Link>
      </section>
  );
}
