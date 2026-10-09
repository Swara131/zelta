"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import HomeHero from "@/components/dashboard/HomeHero";
import HomeAgentCard from "@/components/dashboard/HomeAgentCard";
import HomeLifecycleStats, {
  type HomeLifecycleStatsData,
} from "@/components/dashboard/HomeLifecycleStats";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { buildAgentCards, isDemoAgent } from "@/lib/dashboard/founder-copy";
import {
  countActionsThisMonth,
  countProtectedAgents,
  getLastActionIso,
  isAgentLive,
} from "@/lib/dashboard/home-agent-stats";

const TEMPLATES = [
  "Find AI founder posts and reply",
  "Research competitors every morning",
  "Monitor new leads",
  "Summarize my weekly reports",
  "Answer customer questions",
];

async function fetchAgents(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  if (!response.ok) return [];
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[] };
  return payload.keys ?? [];
}

async function fetchAuditEntries(): Promise<AuditTimelineEntry[]> {
  const response = await fetch("/api/audit/timeline?limit=200");
  if (!response.ok) return [];
  const payload = (await response.json()) as { entries?: AuditTimelineEntry[] };
  return payload.entries ?? [];
}

async function fetchApprovals(): Promise<PendingApproval[]> {
  const response = await fetch("/api/approvals");
  if (!response.ok) return [];
  const payload = (await response.json()) as { approvals?: PendingApproval[] };
  return payload.approvals ?? [];
}

export default function ZeltaHomeDashboard() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentApiKeyRecord[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditTimelineEntry[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [platformStats, setPlatformStats] = useState<HomeLifecycleStatsData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    void fetch("/api/onboarding", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { completed?: boolean }) => {
        if (data.completed === false) {
          router.replace("/onboarding/welcome");
          return;
        }
        setCheckingOnboarding(false);
      })
      .catch(() => setCheckingOnboarding(false))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const [keys, entries, pendingApprovals, monitorRes] = await Promise.all([
      fetchAgents(),
      fetchAuditEntries(),
      fetchApprovals(),
      fetch("/api/monitor/dashboard"),
    ]);
    setAgents(keys);
    setAuditEntries(entries);
    setApprovals(pendingApprovals);
    if (monitorRes.ok) {
      const monitorPayload = (await monitorRes.json()) as {
        stats?: HomeLifecycleStatsData;
      };
      if (monitorPayload.stats) {
        setPlatformStats({
          needsAttention: monitorPayload.stats.needsAttention,
          readyToDeploy: monitorPayload.stats.readyToDeploy,
          running: monitorPayload.stats.activeAgents ?? monitorPayload.stats.running ?? 0,
          pendingApprovals: monitorPayload.stats.pendingApprovals,
          safetyEvents: monitorPayload.stats.safetyEvents,
          agents: keys.filter((key) => !key.revokedAt).length,
          protectedAgents: countProtectedAgents(keys.filter((key) => !key.revokedAt)),
        });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (checkingOnboarding) return;
    void load();
  }, [load, checkingOnboarding]);

  const activeKeys = useMemo(
    () => agents.filter((key) => !key.revokedAt),
    [agents]
  );

  const agentCards = useMemo(() => {
    return buildAgentCards(agents, approvals, auditEntries).filter(
      (agent) => !isDemoAgent(agent)
    );
  }, [agents, approvals, auditEntries]);

  const keysByAgent = useMemo(
    () => new Map(activeKeys.map((key) => [key.agentId, key])),
    [activeKeys]
  );

  const protectedCount = useMemo(() => countProtectedAgents(activeKeys), [activeKeys]);

  if (checkingOnboarding) {
    return (
      <PageShell maxWidth="6xl" className="zhome-page">
        <Skeleton lines={3} className="zhome-skeleton" />
        <Skeleton lines={1} />
      </PageShell>
    );
  }

  const hasAgents = agentCards.length > 0;

  return (
    <PageShell maxWidth="6xl" className="zhome-page">
      <HomeHero protectedCount={protectedCount} />
      <HomeLifecycleStats stats={platformStats} loading={loading} />

      {!hasAgents && !loading ? (
        <section className="zhome-empty">
          <EmptyState
            icon={Bot}
            title="No agents yet"
            description="Build your first AI agent with Wave, then test and protect it before it runs in production."
            primaryAction={{ label: "Create Agent", href: "/agents/create" }}
            secondaryAction={{ label: "Browse templates", href: "/templates" }}
          />
          <div className="zhome-templates">
            <p className="zhome-templates-label">Example ideas</p>
            <ul>
              {TEMPLATES.map((template) => (
                <li key={template}>
                  <button
                    type="button"
                    className="zhome-template-btn"
                    onClick={() =>
                      router.push(
                        `/agents/create?idea=${encodeURIComponent(template)}`
                      )
                    }
                  >
                    {template}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="zhome-agents" aria-labelledby="zhome-agents-heading">
          <h2 id="zhome-agents-heading" className="zhome-section-title">
            Your agents
          </h2>
          <ul className="zhome-agent-grid">
            {agentCards.map((agent, index) => {
              const key = keysByAgent.get(agent.id);
              if (!key) return null;

              return (
                <HomeAgentCard
                  key={agent.id}
                  agentId={agent.id}
                  name={agent.name}
                  href={`/agents/${encodeURIComponent(agent.id)}`}
                  isLive={isAgentLive(agent.id, key)}
                  lastActionIso={getLastActionIso(agent.id, auditEntries, key)}
                  actionsThisMonth={countActionsThisMonth(agent.id, auditEntries)}
                  index={index}
                />
              );
            })}
          </ul>
        </section>
      )}

      <div className="zhome-secondary-grid">
        <section className="ds-card zhome-side-card" aria-labelledby="zhome-activity-heading">
          <h2 id="zhome-activity-heading" className="ds-section-title">
            Recent activity
          </h2>
          {auditEntries.length === 0 ? (
            <p className="zhome-empty-desc">No agent activity yet.</p>
          ) : (
            <ul className="zhome-activity-list">
              {auditEntries.slice(0, 6).map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.title}</strong>
                  <span>{entry.description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ds-card zhome-side-card" aria-labelledby="zhome-approvals-heading">
          <h2 id="zhome-approvals-heading" className="ds-section-title">
            Recent approvals
          </h2>
          {approvals.length === 0 ? (
            <p className="zhome-empty-desc">No pending approvals.</p>
          ) : (
            <ul className="zhome-activity-list">
              {approvals.slice(0, 6).map((approval) => (
                <li key={approval.id}>
                  <strong>{approval.title}</strong>
                  <span>{approval.riskSeverity} risk</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/approvals" className="ds-btn ds-btn-secondary zhome-side-link">
            Open Approvals
          </Link>
        </section>
      </div>

      {loading ? <Skeleton lines={2} className="zhome-skeleton" /> : null}
    </PageShell>
  );
}
