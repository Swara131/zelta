"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import FounderActivityFeed from "./FounderActivityFeed";
import ActivityLogEntry from "./ActivityLogEntry";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import {
  ACTIVITY_DEMO_DISCLAIMER,
  buildDemoActivityViews,
} from "@/lib/audit/demo-activity-events";
import {
  applyActivityFilters,
  buildFounderActivityViews,
  type ActivityFilter,
  type ActivityFilters,
} from "@/lib/audit/activity-copy";
import { filterAgentActionViews } from "@/lib/audit/agent-actions";
import { CTA } from "@/lib/ux/cta-labels";

const DECISION_FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "allowed", label: "Allowed" },
  { id: "review", label: "Approval Required" },
  { id: "blocked", label: "Blocked" },
];

async function fetchGatewayKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[] };
  return payload.keys ?? [];
}

async function fetchAuditTimeline(cursor?: string | null): Promise<{
  entries: AuditTimelineEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const params = new URLSearchParams({ limit: "50" });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/audit/timeline?${params.toString()}`);
  const payload = (await response.json()) as {
    entries?: AuditTimelineEntry[];
    nextCursor?: string | null;
    hasMore?: boolean;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load audit timeline.");
  }

  return {
    entries: payload.entries ?? [],
    nextCursor: payload.nextCursor ?? null,
    hasMore: payload.hasMore ?? false,
  };
}

export default function AuditLogPage() {
  const searchParams = useSearchParams();
  const agentActionsOnly = searchParams.get("type") === "agent_action";

  const [entries, setEntries] = useState<AuditTimelineEntry[]>([]);
  const [connectedKeys, setConnectedKeys] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<ActivityFilter>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchAuditTimeline(), fetchGatewayKeys()])
      .then(([page, keys]) => {
        if (!cancelled) {
          setEntries(page.entries);
          setNextCursor(page.nextCursor);
          setHasMore(page.hasMore);
          setConnectedKeys(keys);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load activity."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasConnectedAgent = connectedKeys.length > 0;
  const realActivities = useMemo(() => buildFounderActivityViews(entries), [entries]);
  const showingDemo = !hasConnectedAgent;
  const activities = useMemo(
    () => (showingDemo ? buildDemoActivityViews() : realActivities),
    [showingDemo, realActivities]
  );

  const scopedActivities = useMemo(
    () => (agentActionsOnly ? filterAgentActionViews(activities) : activities),
    [activities, agentActionsOnly]
  );

  const filteredActivities = useMemo(() => {
    const filters: ActivityFilters = {
      agent: "all",
      decision: decisionFilter,
      actionType: "all",
      date: "all",
    };
    return applyActivityFilters(scopedActivities, filters);
  }, [scopedActivities, decisionFilter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || showingDemo) return;
    setLoadingMore(true);

    try {
      const page = await fetchAuditTimeline(nextCursor);
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load more activity."
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, showingDemo]);

  return (
    <PageShell maxWidth="6xl" className="act-page">
      <PageHeader
        icon={Activity}
        title="Activity & Audit Log"
        description="Complete history of actions evaluated by Wave."
        badge={
          showingDemo ? (
            <span className="ds-badge ds-badge-demo">Simulated data</span>
          ) : (
            <span className="ds-badge ds-badge-brand">
              <Activity className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Audit trail
            </span>
          )
        }
      />

      {showingDemo ? (
        <div className="act-demo-banner" role="note">
          <p>{ACTIVITY_DEMO_DISCLAIMER}</p>
        </div>
      ) : agentActionsOnly ? (
        <p className="act-lead">
          Agent actions only — what was proposed, approved, blocked, or executed.
        </p>
      ) : (
        <p className="act-lead">
          This is the audit trail of AI agent actions — what was proposed, what Wave
          decided, and whether the action completed.
        </p>
      )}

      <section className="act-filters" aria-label="Activity filters">
        <div className="act-filter-pills">
          {DECISION_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`act-filter-pill ${decisionFilter === filter.id ? "act-filter-pill-active" : ""}`}
              aria-pressed={decisionFilter === filter.id}
              onClick={() => setDecisionFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {loadError ? (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <div className="act-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading activity…
        </div>
      ) : !showingDemo && activities.length === 0 ? (
        <div className="act-empty ds-panel">
          <div className="act-empty-icon" aria-hidden="true">
            <Activity className="h-10 w-10" strokeWidth={1.75} />
          </div>
          <h2 className="act-empty-title">No agent activity yet</h2>
          <p className="act-empty-desc">
            When your connected agents propose actions, Wave records each one here —
            what was proposed, how it was evaluated, and the final outcome.
          </p>
          <div className="act-empty-actions">
            <Link href="/test-action" className="ds-btn ds-btn-primary">
              Test an Action
            </Link>
            <Link href="/onboarding/connect" className="ds-btn ds-btn-secondary">
              {CTA.connectExistingAgent}
            </Link>
          </div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="act-empty ds-panel">
          <h2 className="act-empty-title">No activities match this filter</h2>
          <p className="act-empty-desc">Try selecting a different filter to see more events.</p>
        </div>
      ) : (
        <>
          {!showingDemo ? (
            <div className="act-log-list" aria-label="Activity summary">
              {filteredActivities.map((activity) => (
                <ActivityLogEntry key={`summary-${activity.id}`} activity={activity} />
              ))}
            </div>
          ) : null}
          <FounderActivityFeed activities={filteredActivities} />
          {hasMore && !showingDemo ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="ds-btn ds-btn-secondary"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
