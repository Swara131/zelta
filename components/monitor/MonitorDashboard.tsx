"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { formatRunStatusLabel } from "@/lib/agents/runtime/run-status";
import { previewPlainText } from "@/lib/agents/results/parse-agent-result";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatusBadge from "@/components/ui/StatusBadge";

function formatAgentLabel(agentId: string): string {
  if (/^[0-9a-f-]{32,}$/i.test(agentId)) {
    return `Agent ${agentId.slice(0, 8)}`;
  }
  return agentId.replaceAll("-", " ");
}

function runTone(status: string) {
  if (status === "succeeded" || status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status.includes("approval")) return "pending" as const;
  return "info" as const;
}

interface MonitorStats {
  activeAgents: number;
  needsAttention: number;
  readyToDeploy: number;
  pendingApprovals: number;
  safetyEvents: number;
  successfulRuns: number;
  failedRuns: number;
  decisionAgents: number;
}

interface MonitorRun {
  id: string;
  agentId: string;
  status: string;
  summary?: string | null;
  createdAt: string;
}

interface MonitorAudit {
  timestamp?: string;
  title?: string;
  description?: string;
  action?: string;
  runtimeEvent?: string | null;
}

export default function MonitorDashboard() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [audit, setAudit] = useState<MonitorAudit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const response = await fetch("/api/monitor/dashboard");
    const payload = (await response.json()) as {
      stats?: MonitorStats;
      recentRuns?: MonitorRun[];
      auditPreview?: MonitorAudit[];
    };
    setStats(payload.stats ?? null);
    setRuns(payload.recentRuns ?? []);
    setAudit(payload.auditPreview ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <PageShell maxWidth="7xl" className="zmon-page">
      <PageHeader
        title="Monitor"
        description="Track agent runs, success rate, blocked actions, and approval requests."
      />

      {loading ? (
        <Skeleton lines={6} />
      ) : stats ? (
        <>
          <div className="zmon-stats">
            <article className="zmon-stat"><span>{stats.activeAgents}</span><p>Agent runs (active)</p></article>
            <article className="zmon-stat"><span>{
              stats.successfulRuns + stats.failedRuns === 0
                ? "—"
                : `${Math.round((stats.successfulRuns / (stats.successfulRuns + stats.failedRuns)) * 100)}%`
            }</span><p>Success rate</p></article>
            <article className="zmon-stat"><span>{stats.failedRuns}</span><p>Failures</p></article>
            <article className="zmon-stat"><span>{stats.safetyEvents}</span><p>Blocked actions</p></article>
            <article className="zmon-stat"><span>{stats.pendingApprovals}</span><p>Approval requests</p></article>
            <article className="zmon-stat"><span>{stats.decisionAgents}</span><p>Decision agents</p></article>
          </div>

          <section className="ds-panel zmon-panel">
            <h2>Recent runs</h2>
            {runs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No runs yet"
                description="When agents execute, their runs will appear here."
                primaryAction={{ label: "Open Agents", href: "/agents/platform" }}
              />
            ) : (
              <ul className="zmon-runs">
                {runs.map((run) => (
                  <li key={run.id} className="zmon-run">
                    <StatusBadge tone={runTone(run.status)}>
                      {formatRunStatusLabel(run.status)}
                    </StatusBadge>
                    <div className="zmon-run-body">
                      <strong>{formatAgentLabel(run.agentId)}</strong>
                      <p>{previewPlainText(run.summary ?? "Run recorded", 140)}</p>
                    </div>
                    <time dateTime={run.createdAt}>
                      {new Date(run.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ds-panel zmon-panel">
            <h2>Execution timeline</h2>
            {audit.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Execution events will show up on this timeline."
              />
            ) : (
              <ul className="zmon-timeline">
                {audit.map((entry, index) => (
                  <li key={`${entry.timestamp ?? "t"}-${index}`}>
                    <time>
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </time>
                    <div>
                      <strong>{entry.title ?? entry.runtimeEvent ?? entry.action ?? "Event"}</strong>
                      {entry.description ? (
                        <p>{previewPlainText(entry.description, 120)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="zmon-links">
            <Link href="/approvals" className="zplat-btn zplat-btn-secondary">Approvals</Link>
            <Link href="/safety" className="zplat-btn zplat-btn-secondary">Safety</Link>
            <Link href="/audit" className="zplat-btn zplat-btn-secondary">Activity log</Link>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
