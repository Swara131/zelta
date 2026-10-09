"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Loader2,
  Pause,
  ShieldCheck,
  X,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import SafetyHero from "@/components/safety/SafetyHero";
import SafetyControlLayers from "@/components/safety/SafetyControlLayers";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import SafetyOverviewStats from "@/components/safety/SafetyOverviewStats";
import SafetyPolicyCards from "@/components/safety/SafetyPolicyCards";
import { DecisionBadge, ProtectionStatusBadge } from "@/components/safety/SafetyBadges";
import {
  hashVerificationLabel,
  passportStatusLabel,
} from "@/lib/safety/center/copy";
import type {
  AgentMissionRow,
  SafetyCenterPayload,
  SafetyEventDetail,
  SafetyEventRow,
} from "@/lib/safety/center/types";
import { formatRelativeTime } from "@/lib/audit/activity-copy";

function EventDetailDrawer({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SafetyEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/safety/events/${encodeURIComponent(eventId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          event?: SafetyEventDetail;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load event details.");
        }
        if (!cancelled) setDetail(payload.event ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="sc-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="sc-drawer ds-panel"
        role="dialog"
        aria-labelledby="sc-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sc-drawer-header">
          <h2 id="sc-drawer-title" className="sc-drawer-title">
            Action details
          </h2>
          <button type="button" className="sc-icon-btn" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="sc-muted">
            <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : error ? (
          <p className="sc-error">{error}</p>
        ) : detail ? (
          <div className="sc-drawer-body">
            <p className="sc-lead">{detail.founderSummary}</p>
            <p className="sc-reason">{detail.founderReason}</p>

            <dl className="sc-detail-grid">
              <DetailItem label="Agent" value={detail.agent.name} />
              <DetailItem label="Mission" value={detail.mission ?? "No mission set"} />
              <DetailItem label="Tool" value={detail.tool ?? "—"} />
              <DetailItem label="Action" value={detail.action ?? "—"} />
              <DetailItem label="Policy decision" value={detail.policyDecision ?? "—"} />
              <DetailItem label="Mission check" value={detail.missionDecision ?? "—"} />
              <DetailItem label="Risk level" value={detail.riskDecision ?? "—"} />
              <DetailItem
                label="Passport"
                value={passportStatusLabel(detail.passport.status)}
              />
              <DetailItem
                label="Hash verification"
                value={hashVerificationLabel(detail.passport.hashVerified)}
              />
              <DetailItem label="Approval" value={detail.approval.status ?? "—"} />
              <DetailItem label="Execution" value={detail.execution.status ?? "—"} />
              <DetailItem
                label="Time"
                value={new Date(detail.timestamp).toLocaleString()}
              />
            </dl>

            {Object.keys(detail.parameters).length > 0 ? (
              <div className="sc-params">
                <h3 className="sc-subsection-title">Relevant parameters</h3>
                <ul className="sc-param-list">
                  {Object.entries(detail.parameters).map(([key, value]) => (
                    <li key={key}>
                      <span className="sc-param-key">{key}</span>
                      <span className="sc-param-value">{String(value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="sc-drawer-actions">
              {detail.agent.slug ? (
                <Link
                  href={`/agents/${encodeURIComponent(detail.agent.slug)}`}
                  className="ds-btn ds-btn-secondary"
                >
                  View agent
                </Link>
              ) : null}
              {detail.approval.status === "review_required" ? (
                <Link href="/approvals" className="ds-btn ds-btn-primary">
                  Review approval
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="sc-muted">Event not found.</p>
        )}
      </aside>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sc-detail-label">{label}</dt>
      <dd className="sc-detail-value">{value}</dd>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="sc-empty ds-panel">
      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export default function SafetyCenterPage() {
  const [data, setData] = useState<SafetyCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pausingSlug, setPausingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/safety/center");
      const payload = (await response.json()) as SafetyCenterPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load Safety Center.");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Safety Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pauseAgent = useCallback(async (slug: string) => {
    setPausingSlug(slug);
    try {
      const response = await fetch(`/api/v1/agents/status/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to pause agent.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause agent.");
    } finally {
      setPausingSlug(null);
    }
  }, [load]);

  const hasData = useMemo(() => {
    if (!data) return false;
    return (
      data.events.length > 0 ||
      data.missions.length > 0 ||
      data.overview.protectedAgents > 0
    );
  }, [data]);

  return (
    <PageShell maxWidth="7xl" className="sc-page">
      <SafetyHero />
      <SafetyControlLayers />

      {loading ? (
        <Skeleton lines={6} />
      ) : error ? (
        <ErrorState
          title="Wave couldn't load safety data."
          description="Protection is still active. Try again to refresh this view."
          onFix={() => void load()}
          fixLabel="Try again"
          technical={error}
        />
      ) : data ? (
        <div className="sc-layout">
          <SafetyOverviewStats overview={data.overview} />

          <section className="sc-section" aria-labelledby="sc-policies-heading">
            <div className="sc-section-head">
              <div>
                <h2 id="sc-policies-heading" className="sc-section-title sc-section-title-icon">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  Active Policies
                </h2>
                <p className="sc-section-desc">Rules that protect your agents</p>
              </div>
              <Link href="/settings" className="sc-link">
                View policy settings
              </Link>
            </div>
            {data.policies.length === 0 ? (
              <EmptyPanel message="No policies configured yet. Wave uses built-in protection rules once agents are active." />
            ) : (
              <SafetyPolicyCards policies={data.policies} />
            )}
          </section>

          <section className="sc-section" aria-labelledby="sc-missions-heading">
            <h2 id="sc-missions-heading" className="sc-section-title">
              Agent missions
            </h2>
            {data.missions.length === 0 ? (
              <EmptyPanel message="No agents yet. Create an agent and Wave will show its mission and allowed tools here." />
            ) : (
              <ul className="sc-mission-grid">
                {data.missions.map((mission: AgentMissionRow) => (
                  <li key={mission.agentId} className="sc-mission-card ds-panel">
                    <div className="sc-mission-head">
                      <div>
                        <h3 className="sc-mission-name">{mission.agentName}</h3>
                        <p className="sc-mission-goal">
                          {mission.missionGoal ?? "No mission goal set yet"}
                        </p>
                      </div>
                      <ProtectionStatusBadge status={mission.protectionStatus} />
                    </div>
                    <p className="sc-mission-meta">
                      <strong>Allowed tools:</strong>{" "}
                      {mission.allowedTools.length > 0
                        ? mission.allowedTools.join(", ")
                        : "None configured"}
                    </p>
                    {mission.restrictions.length > 0 ? (
                      <p className="sc-mission-meta">
                        <strong>Restrictions:</strong> {mission.restrictions.join(", ")}
                      </p>
                    ) : null}
                    <div className="sc-mission-actions">
                      <Link
                        href={`/agents/${encodeURIComponent(mission.agentSlug)}`}
                        className="ds-btn ds-btn-secondary sc-btn-sm"
                      >
                        View agent
                      </Link>
                      {mission.protectionStatus === "active" ? (
                        <button
                          type="button"
                          className="ds-btn ds-btn-secondary sc-btn-sm"
                          disabled={pausingSlug === mission.agentSlug}
                          onClick={() => void pauseAgent(mission.agentSlug)}
                        >
                          {pausingSlug === mission.agentSlug ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pause className="h-3.5 w-3.5" />
                          )}
                          Pause agent
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sc-section" aria-labelledby="sc-events-heading">
            <div className="sc-section-head">
              <h2 id="sc-events-heading" className="sc-section-title">
                Recent safety events
              </h2>
              <Link href="/audit" className="sc-link">
                View full activity
              </Link>
            </div>
            {!hasData || data.events.length === 0 ? (
              <EmptyPanel message="No safety events yet. Wave will show decisions here when your agent starts performing actions." />
            ) : (
              <ul className="sc-event-list">
                {data.events.map((event: SafetyEventRow) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="sc-event-row ds-panel"
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      <div className="sc-event-main">
                        <div className="sc-event-top">
                          <DecisionBadge decision={event.decision} />
                          <span className="sc-event-time">
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="sc-event-action">
                          <strong>{event.agentName}</strong> · {event.action}
                        </p>
                        <p className="sc-event-reason">{event.reason}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 sc-event-chevron" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {selectedEventId ? (
        <EventDetailDrawer eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      ) : null}
    </PageShell>
  );
}
