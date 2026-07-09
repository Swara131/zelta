"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Filter } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AuditTimelineFeed from "./AuditTimelineFeed";
import type { AuditTimelineEntry } from "@/lib/audit/types";

type SourceFilter = "all" | "runtime" | "retrospective";

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All Events" },
  { key: "runtime", label: "Gateway Runtime" },
  { key: "retrospective", label: "Log Analysis" },
];

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
  const [entries, setEntries] = useState<AuditTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchAuditTimeline()
      .then((page) => {
        if (!cancelled) {
          setEntries(page.entries);
          setNextCursor(page.nextCursor);
          setHasMore(page.hasMore);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load audit timeline."
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

  const filtered = entries.filter((entry) => {
    if (sourceFilter === "all") return true;
    if (sourceFilter === "runtime") return entry.source === "runtime";
    return entry.source !== "runtime";
  });

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const page = await fetchAuditTimeline(nextCursor);
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load more audit events."
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

  return (
    <PageShell maxWidth="4xl">
      <PageHeader
        icon={History}
        title="Audit Log"
        description="Immutable timeline of gateway runtime events and retrospective log-analysis activity for your organization."
        badge={
          <span className="ds-badge ds-badge-brand">
            <History className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {entries.length} events
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter audit source">
        {SOURCE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sourceFilter === key}
            onClick={() => setSourceFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              sourceFilter === key
                ? "bg-[var(--ds-brand)] text-white"
                : "bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]"
            }`}
          >
            {key !== "all" && <Filter className="h-3 w-3" strokeWidth={2} />}
            {label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--ds-text-secondary)]">Loading audit timeline…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit events yet"
          description="Gateway proposals, policy decisions, approvals, and log-analysis activity will appear here automatically."
        />
      ) : (
        <>
          <AuditTimelineFeed entries={filtered} />
          {hasMore && sourceFilter === "all" && (
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
          )}
        </>
      )}
    </PageShell>
  );
}
