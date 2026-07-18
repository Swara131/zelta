"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ApprovalCard from "./ApprovalCard";
import type { ApprovalStatus, PendingApproval } from "@/lib/approval-types";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  findAuthorizedProposalForDeepLink,
  parseProposalDeepLinkParam,
  shouldClearFilterForDeepLink,
  type ProposalDeepLinkFilter,
} from "@/lib/approvals/proposal-deep-link";

type FilterKey = ProposalDeepLinkFilter;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "info";
}

async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const response = await fetch("/api/approvals");
  const payload = (await response.json()) as {
    approvals?: PendingApproval[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load approvals.");
  }

  return payload.approvals ?? [];
}

export default function PendingApprovalsPage() {
  const searchParams = useSearchParams();
  const deepLinkProposalId = parseProposalDeepLinkParam(searchParams.get("proposal"));

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<Toast | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [highlightedProposalId, setHighlightedProposalId] = useState<string | null>(
    null
  );
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    let cancelled = false;

    void fetchPendingApprovals()
      .then((items) => {
        if (!cancelled) setApprovals(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load approvals."
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

  useEffect(() => {
    if (loading || !deepLinkProposalId) {
      return;
    }

    const match = findAuthorizedProposalForDeepLink(approvals, deepLinkProposalId);
    if (!match) {
      return;
    }

    if (shouldClearFilterForDeepLink(filter, match)) {
      setFilter("all");
    }

    setHighlightedProposalId(match.id);

    const scrollTimer = window.setTimeout(() => {
      const node =
        cardRefs.current.get(match.id) ??
        document.querySelector(`[data-proposal-id="${match.id}"]`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedProposalId(null);
    }, 8000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [loading, approvals, deepLinkProposalId, filter]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? approvals
        : approvals.filter((a) => a.riskSeverity === filter),
    [approvals, filter]
  );

  const stats = useMemo(
    () => ({
      total: approvals.length,
      critical: approvals.filter((a) => a.riskSeverity === "critical").length,
      p1: approvals.filter((a) => a.priority === "p1").length,
    }),
    [approvals]
  );

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = crypto.randomUUID();
    setToast({ id, message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const handleAction = useCallback(
    async (id: string, action: ApprovalStatus, comment?: string) => {
      if (action === "pending") return;

      const labels: Record<ApprovalStatus, string> = {
        approved: "Approved",
        rejected: "Rejected",
        changes_requested: "Changes requested",
        escalated: "Escalated to senior reviewer",
        pending: "Pending",
      };

      setRemovingId(id);

      try {
        const response = await fetch(`/api/approvals/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: action, note: comment }),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to process decision.");
        }

        setTimeout(() => {
          setApprovals((prev) => prev.filter((a) => a.id !== id));
          setRemovingId(null);
          showToast(
            `${labels[action]}${comment ? " with comment" : ""} — ${id}`,
            action === "approved"
              ? "success"
              : action === "rejected"
                ? "warning"
                : "info"
          );
        }, 400);
      } catch (err) {
        setRemovingId(null);
        showToast(
          err instanceof Error ? err.message : "Failed to process decision.",
          "warning"
        );
      }
    },
    []
  );

  return (
    <PageShell maxWidth="4xl">
      <PageHeader
        icon={ClipboardCheck}
        title="Pending Approvals"
        description="Review AI-flagged actions requiring human authorization. Each card includes risk context, business justification, and recommended next steps."
        badge={
          <span className="ds-badge ds-badge-brand">
            <ClipboardCheck className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {stats.total} pending
          </span>
        }
      />

      <section
        className="ds-section grid grid-cols-3 gap-3"
        aria-label="Approval statistics"
      >
        {[
          { icon: Clock, label: "Pending", value: stats.total },
          { icon: AlertCircle, label: "Critical", value: stats.critical },
          { icon: CheckCircle2, label: "P1 Priority", value: stats.p1 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="ds-stat-card">
            <div className="ds-stat-label">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {label}
            </div>
            <p className="ds-stat-value">{value}</p>
          </div>
        ))}
      </section>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by severity">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-[var(--ds-brand)] text-white"
                : "bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]"
            }`}
          >
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
        <p className="text-sm text-[var(--ds-text-secondary)]">Loading approvals…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No pending approvals"
          description="When AI actions require human review, they will appear here for authorization."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((approval, index) => (
            <div
              key={approval.id}
              className={removingId === approval.id ? "approval-card-exit" : ""}
              ref={(node) => {
                cardRefs.current.set(approval.id, node);
              }}
            >
              <ApprovalCard
                approval={approval}
                index={index}
                highlighted={highlightedProposalId === approval.id}
                onAction={handleAction}
              />
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "warning"
                ? "bg-amber-600 text-white"
                : "bg-indigo-600 text-white"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </PageShell>
  );
}
