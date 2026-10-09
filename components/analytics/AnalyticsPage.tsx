"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import InsightsMetricGrid from "./InsightsMetricGrid";
import InsightsProtectionBreakdown from "./InsightsProtectionBreakdown";
import InsightsTopRiskyActions from "./InsightsTopRiskyActions";
import InsightsAgentProtection from "./InsightsAgentProtection";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import {
  buildDemoFounderInsights,
  INSIGHTS_DEMO_DISCLAIMER,
} from "@/lib/analytics/demo-insights";
import {
  buildFounderInsights,
  INSIGHTS_PAGE_QUESTION,
} from "@/lib/analytics/founder-insights";
import { CTA } from "@/lib/ux/cta-labels";

async function fetchGatewayKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[] };
  return payload.keys ?? [];
}

async function fetchAuditEntries(): Promise<AuditTimelineEntry[]> {
  const response = await fetch("/api/audit/timeline?limit=200");
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { entries?: AuditTimelineEntry[] };
  return payload.entries ?? [];
}

export default function AnalyticsPage() {
  const [entries, setEntries] = useState<AuditTimelineEntry[]>([]);
  const [connectedKeys, setConnectedKeys] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [auditEntries, keys] = await Promise.all([
        fetchAuditEntries(),
        fetchGatewayKeys(),
      ]);
      setEntries(auditEntries);
      setConnectedKeys(keys);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasConnectedAgent = connectedKeys.length > 0;
  const showingDemo = !hasConnectedAgent;
  const insights = useMemo(
    () => (showingDemo ? buildDemoFounderInsights() : buildFounderInsights(entries)),
    [showingDemo, entries]
  );

  return (
    <PageShell maxWidth="6xl" className="ins-page">
      <PageHeader
        icon={BarChart3}
        title="Protection Insights"
        description={INSIGHTS_PAGE_QUESTION}
        badge={
          showingDemo ? (
            <span className="ds-badge ds-badge-demo">Simulated data</span>
          ) : undefined
        }
      />

      {showingDemo ? (
        <div className="ins-demo-banner" role="note">
          <p>{INSIGHTS_DEMO_DISCLAIMER}</p>
        </div>
      ) : null}

      {loadError ? (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <div className="ins-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading protection insights…
        </div>
      ) : !showingDemo && !insights.hasData ? (
        <section className="ds-section">
          <div className="ins-empty-panel ds-panel">
            <h2 className="ins-empty-title">No protection activity yet</h2>
            <p className="ins-empty-desc">
              When your connected agents propose actions, Wave records how each one was
              checked, allowed, sent for approval, or blocked.
            </p>
            <div className="ins-empty-actions">
              <Link href="/test-action" className="ds-btn ds-btn-primary">
                Test an Action
              </Link>
              <Link href="/onboarding/connect" className="ds-btn ds-btn-secondary">
                {CTA.connectExistingAgent}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="ds-section" aria-labelledby="insights-metrics-heading">
            <InsightsMetricGrid metrics={insights.metrics} />
          </section>

          <section className="ds-section" aria-labelledby="protection-overview-heading">
            <h2 id="protection-overview-heading" className="ins-section-title">
              Protection Overview
            </h2>
            <p className="ins-section-desc">
              How Wave handled every checked action — allowed, sent for approval, or blocked.
            </p>
            <div className="ds-panel ins-panel">
              <InsightsProtectionBreakdown items={insights.protectionBreakdown} />
            </div>
          </section>

          <section className="ds-section" aria-labelledby="top-risky-actions-heading">
            <h2 id="top-risky-actions-heading" className="ins-section-title">
              Top Risky Actions
            </h2>
            <p className="ins-section-desc">
              Action types Wave watches most closely because they can affect customers, access,
              or data.
            </p>
            <InsightsTopRiskyActions items={insights.topRiskyActions} />
          </section>

          <section className="ds-section" aria-labelledby="agent-protection-heading">
            <h2 id="agent-protection-heading" className="ins-section-title">
              Agent Protection
            </h2>
            <p className="ins-section-desc">
              How each agent is performing under your protection rules.
            </p>
            <InsightsAgentProtection agents={insights.agentProtection} />
          </section>

          <section className="ds-section">
            <article className="ins-explainer ds-panel">
              <h2 className="ins-explainer-title">What this tells you</h2>
              <p className="ins-explainer-body">
                These insights show whether Wave is letting safe actions through, pausing risky
                ones for your approval, and blocking actions that break your rules. Every number
                reflects a real protection decision — not generic analytics.
              </p>
              <Link href="/audit" className="ds-btn ds-btn-secondary ins-explainer-link">
                {CTA.viewActivity}
              </Link>
            </article>
          </section>
        </>
      )}
    </PageShell>
  );
}
