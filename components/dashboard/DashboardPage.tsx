"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Circle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import OverviewAgentCTA from "@/components/dashboard/OverviewAgentCTA";
import GettingStartedProgressEmptyState from "@/components/trust/empty-states/GettingStartedProgressEmptyState";
import ApprovalsAllClearEmptyState from "@/components/trust/empty-states/ApprovalsAllClearEmptyState";
import OverviewYourAgentsSection from "@/components/dashboard/OverviewYourAgentsSection";
import RecentAgentActivitySection from "@/components/dashboard/RecentAgentActivitySection";
import AgentBuilderModal from "@/components/agent-builder/AgentBuilderModal";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import {
  buildControlCenterData,
  CONTROL_CENTER_DEMO_DISCLAIMER,
  type SecurityStatusSummary,
} from "@/lib/dashboard/control-center";
import { buildAgentCards, isDemoAgent } from "@/lib/dashboard/founder-copy";
import {
  buildGettingStartedChecklist,
  shouldShowGettingStartedChecklist,
} from "@/lib/dashboard/getting-started-checklist";
import {
  buildMonthlyProtectionSummary,
  buildOnboardingProgress,
} from "@/lib/dashboard/trust-empty-states";

function protectionToneClass(tone: SecurityStatusSummary["protectionTone"]): string {
  switch (tone) {
    case "good":
      return "cc-status-good";
    case "warn":
      return "cc-status-warn";
    default:
      return "cc-status-neutral";
  }
}

export default function DashboardPage() {
  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, approvalsRes, auditRes] = await Promise.all([
        fetch("/api/gateway/keys"),
        fetch("/api/approvals"),
        fetch("/api/audit/timeline?limit=40"),
      ]);

      if (keysRes.ok) {
        const payload = (await keysRes.json()) as { keys?: AgentApiKeyRecord[] };
        setKeys(payload.keys ?? []);
      }

      if (approvalsRes.ok) {
        const payload = (await approvalsRes.json()) as { approvals?: PendingApproval[] };
        setApprovals(payload.approvals ?? []);
      }

      if (auditRes.ok) {
        const payload = (await auditRes.json()) as { entries?: AuditTimelineEntry[] };
        setAuditEntries(payload.entries ?? []);
      } else {
        setAuditEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const controlCenter = useMemo(
    () => buildControlCenterData(keys, approvals, auditEntries),
    [keys, approvals, auditEntries]
  );

  const { securityStatus, attentionItems, recentActivity, setupProgress } = controlCenter;

  const hasRealAgents = useMemo(
    () =>
      buildAgentCards(keys, approvals, auditEntries).some((agent) => !isDemoAgent(agent)),
    [keys, approvals, auditEntries]
  );

  const gettingStarted = useMemo(
    () => buildGettingStartedChecklist(keys, auditEntries),
    [keys, auditEntries]
  );

  const showGettingStartedChecklist = shouldShowGettingStartedChecklist(
    gettingStarted.realAgentCount
  );

  const onboardingProgress = useMemo(
    () => buildOnboardingProgress(keys, auditEntries),
    [keys, auditEntries]
  );

  const monthlyProtectionSummary = useMemo(
    () =>
      buildMonthlyProtectionSummary(auditEntries, {
        useDemoFallback: controlCenter.isSimulated && hasRealAgents,
      }),
    [auditEntries, controlCenter.isSimulated, hasRealAgents]
  );

  return (
    <PageShell
      maxWidth="6xl"
      className={`cc-page ${!hasRealAgents ? "cc-page-empty" : ""}`}
    >
      <header className="cc-header fade-in-up">
        <h1 className="cc-title">Wave Control Center</h1>
        <p className="cc-subtitle">
          Control what your AI agents can do before they take real-world actions.
        </p>
      </header>

      {controlCenter.isSimulated ? (
        <p className="cc-demo-banner" role="note">
          {CONTROL_CENTER_DEMO_DISCLAIMER}
        </p>
      ) : null}

      <section
        className={`cc-status-section ${!hasRealAgents ? "cc-status-section-compact" : ""}`}
        aria-labelledby="cc-status-heading"
      >
        <h2 id="cc-status-heading" className="cc-section-kicker">
          Your security status
        </h2>

        {loading ? (
          <div className="cc-loading">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading status…
          </div>
        ) : (
          <div className="cc-status-panel ds-panel">
            <div className="cc-status-primary">
              <p className="cc-status-agents">
                <span className="cc-status-agents-count">{securityStatus.agentCount}</span>
                <span className="cc-status-agents-label">
                  Agent{securityStatus.agentCount === 1 ? "" : "s"}
                </span>
              </p>
              <p className={`cc-status-badge ${protectionToneClass(securityStatus.protectionTone)}`}>
                {securityStatus.protectionLabel}
              </p>
            </div>

            <dl className="cc-status-breakdown">
              <div>
                <dt>Actions evaluated</dt>
                <dd>{securityStatus.actionsEvaluated}</dd>
              </div>
              <div className="cc-status-allow">
                <dt>Allowed</dt>
                <dd>{securityStatus.allowed}</dd>
              </div>
              <div className="cc-status-review">
                <dt>Awaiting approval</dt>
                <dd>{securityStatus.awaitingApproval}</dd>
              </div>
              <div className="cc-status-block">
                <dt>Blocked</dt>
                <dd>{securityStatus.blocked}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      <OverviewAgentCTA prominent={!hasRealAgents} />

      {showGettingStartedChecklist ? (
        <GettingStartedProgressEmptyState progress={onboardingProgress} />
      ) : null}

      {hasRealAgents ? (
        <OverviewYourAgentsSection
          keys={keys}
          approvals={approvals}
          auditEntries={auditEntries}
        />
      ) : null}

      <section className="cc-section" aria-labelledby="cc-attention-heading">
        <h2 id="cc-attention-heading" className="cc-section-kicker">
          Requires your attention
        </h2>
        <p className="cc-section-desc cc-section-desc-spaced">
          Actions Wave paused because they need your decision before they can run.
        </p>

        {loading ? (
          <div className="cc-loading">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : attentionItems.length > 0 ? (
          <ul className="cc-attention-list">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <article className="cc-attention-item ds-panel">
                  <div className="cc-attention-icon" aria-hidden="true">
                    <ShieldAlert className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="cc-attention-body">
                    <p className="cc-attention-headline">
                      {item.isSimulated ? "⚠ " : ""}
                      {item.headline}
                    </p>
                    <p className="cc-attention-agent">{item.agentName}</p>
                    <div className="cc-attention-tags">
                      <span className="cc-attention-tag">{item.riskLabel} risk</span>
                      <span className="cc-attention-tag cc-attention-tag-review">
                        {item.decisionLabel}
                      </span>
                      {item.isSimulated ? (
                        <span className="cc-attention-tag cc-attention-tag-demo">Sample</span>
                      ) : null}
                    </div>
                  </div>
                  <Link href={item.href} className="ds-btn ds-btn-primary cc-attention-cta">
                    {item.cta}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <ApprovalsAllClearEmptyState summary={monthlyProtectionSummary} />
        )}
      </section>

      <RecentAgentActivitySection actions={recentActivity} loading={loading} />

      {!showGettingStartedChecklist ? (
        <section className="cc-setup ds-panel" aria-labelledby="cc-setup-heading">
          <h2 id="cc-setup-heading" className="cc-section-kicker">
            Get started
          </h2>
          <p className="cc-section-desc cc-section-desc-spaced">
            Follow these steps to connect an agent and start protecting real actions.
          </p>

          <ol className="cc-setup-list">
            {setupProgress.items.map((item) => (
              <li
                key={item.id}
                className={`cc-setup-item ${item.complete ? "cc-setup-item-done" : ""}`}
              >
                {item.complete ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-[var(--ds-text-tertiary)]" strokeWidth={2} />
                )}
                <span>{item.label}</span>
              </li>
            ))}
          </ol>

          {setupProgress.showContinue ? (
            <Link href={setupProgress.continueHref} className="ds-btn ds-btn-primary cc-setup-cta">
              Continue Setup
            </Link>
          ) : (
            <p className="cc-setup-complete">
              You&apos;re set up — your agents are protected and ready to go.
            </p>
          )}
        </section>
      ) : null}

      <AgentBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </PageShell>
  );
}
