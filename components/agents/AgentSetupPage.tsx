"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Shield,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import AgentTryDemoSection from "@/components/agents/setup/AgentTryDemoSection";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import {
  buildAgentSetupSummary,
  computeAgentOnboarding,
  loadAgentLifecycle,
  ONBOARDING_STEPS,
  stepCompletion,
} from "@/lib/agent-builder/agent-onboarding";
import SecurityPipeline from "@/components/ui/SecurityPipeline";
import { computeProtectionToday } from "@/lib/dashboard/founder-copy";
import TemplateSetupChecklist from "@/components/agents/templates/TemplateSetupChecklist";

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load agents.");
  }
  return payload.keys ?? [];
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="ds-btn ds-btn-ghost ds-btn-sm inline-flex items-center gap-1.5"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function ProgressIndicator({ completed }: { completed: boolean[] }) {
  return (
    <ol className="ag-progress" aria-label="Setup progress">
      {ONBOARDING_STEPS.map((step, index) => {
        const done = completed[index];
        const current = !done && completed.slice(0, index).every(Boolean);
        return (
          <li
            key={step.id}
            className={`ag-progress-step ${done ? "ag-progress-step-done" : ""} ${current ? "ag-progress-step-current" : ""}`}
          >
            <span className="ag-progress-marker" aria-hidden="true">
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="ag-progress-label">{step.label}</span>
            {done ? <span className="sr-only"> — complete</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function AgentSetupPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const fromTemplate = searchParams.get("from") === "template";

  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const session = useMemo(
    () => (agentId ? loadCreatedAgentSession(agentId) : null),
    [agentId]
  );

  const loadData = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoadError(null);
    try {
      const [keysResult, approvalsRes, auditRes] = await Promise.all([
        fetchAgentKeys(),
        fetch("/api/approvals"),
        fetch("/api/audit/timeline?limit=200"),
      ]);

      setKeys(keysResult);

      if (approvalsRes.ok) {
        const payload = (await approvalsRes.json()) as { approvals?: PendingApproval[] };
        setApprovals(payload.approvals ?? []);
      }

      if (auditRes.ok) {
        const payload = (await auditRes.json()) as { entries?: AuditTimelineEntry[] };
        setAuditEntries(payload.entries ?? []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load agent.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const key = useMemo(
    () => keys.find((item) => !item.revokedAt && item.agentId === agentId) ?? null,
    [keys, agentId]
  );

  const lifecycle = useMemo(
    () => (agentId ? loadAgentLifecycle(agentId) : loadAgentLifecycle("")),
    [agentId]
  );

  const onboarding = useMemo(() => {
    if (!agentId) return null;
    return computeAgentOnboarding(
      {
        agentId,
        key,
        spec: session?.spec ?? null,
        approvals,
        auditEntries,
      },
      { lifecycle }
    );
  }, [agentId, key, session, approvals, auditEntries, lifecycle]);

  const summary = useMemo(() => {
    if (!agentId) return null;
    return buildAgentSetupSummary({
      agentId,
      key,
      spec: session?.spec ?? null,
      approvals,
      auditEntries,
    });
  }, [agentId, key, session, approvals, auditEntries]);

  const todayStats = useMemo(
    () =>
      computeProtectionToday(
        auditEntries,
        approvals.filter((a) => a.agentId === agentId).length
      ),
    [auditEntries, approvals, agentId]
  );

  const connectHref = `/integrations?agent=${encodeURIComponent(agentId)}&connect=1`;
  const protectionHref = "/risk";
  const testPageHref = `/test-action?agent=${encodeURIComponent(agentId)}`;

  if (!agentId) {
    return (
      <PageShell maxWidth="4xl">
        <div className="ag-missing ds-panel">
          <h1 className="ag-title">Agent not found</h1>
          <p className="ag-lead">Choose an agent from My Agents or create a new one.</p>
          <div className="ag-missing-actions">
            <Link href="/agents/build" className="ds-btn ds-btn-primary">
              Create Agent
            </Link>
            <Link href="/integrations" className="ds-btn ds-btn-secondary">
              My Agents
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell maxWidth="4xl">
        <div className="ag-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading agent setup…
        </div>
      </PageShell>
    );
  }

  if (!key) {
    return (
      <PageShell maxWidth="4xl">
        <div className="ag-missing ds-panel">
          <h1 className="ag-title">Agent not found</h1>
          <p className="ag-lead">
            We couldn&apos;t find this agent. It may have been removed or the link is outdated.
          </p>
          <div className="ag-missing-actions">
            <Link href="/integrations" className="ds-btn ds-btn-primary">
              My Agents
            </Link>
            <Link href="/agents/build" className="ds-btn ds-btn-secondary">
              Create Agent
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const isProtected = lifecycle.activated && lifecycle.testActionPassed;

  return (
    <PageShell maxWidth="4xl" className="ag-page">
      <div className="ag-flow fade-in-up">
        {loadError ? (
          <p className="ag-error" role="alert">
            {loadError}
          </p>
        ) : null}

        <div className="ag-ready-badge">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          {isProtected ? "Agent protected" : "Your agent is ready"}
        </div>

        <h1 className="ag-title">{summary?.name}</h1>
        <p className="ag-lead">{summary?.description}</p>

        {fromTemplate || session?.templateName ? <TemplateSetupChecklist /> : null}

        <div className="ag-top-actions">
          <Link href={testPageHref} className="ds-btn ds-btn-secondary ds-btn-sm">
            Test Action
          </Link>
          <Link href={protectionHref} className="ds-btn ds-btn-secondary ds-btn-sm">
            Protection
          </Link>
          <Link href={connectHref} className="ds-btn ds-btn-secondary ds-btn-sm">
            Connection
          </Link>
        </div>

        <p className="ag-status-line">
          {isProtected ? "🟢 Protected" : onboarding?.statusEmoji}{" "}
          {isProtected ? "Protected" : onboarding?.statusLabel}
          {key?.lastUsedAt ? " · Connected" : " · Not connected"}
        </p>

        {onboarding ? (
          <ProgressIndicator completed={stepCompletion(lifecycle)} />
        ) : null}

        {(todayStats.allowed > 0 || todayStats.needsApproval > 0 || todayStats.blocked > 0) ? (
          <section className="ag-today ds-panel" aria-labelledby="ag-today-heading">
            <h2 id="ag-today-heading" className="ag-section-title">
              Actions today
            </h2>
            <dl className="ag-today-grid">
              <div>
                <dt>Allowed</dt>
                <dd>{todayStats.allowed}</dd>
              </div>
              <div>
                <dt>Needs approval</dt>
                <dd>{todayStats.needsApproval}</dd>
              </div>
              <div>
                <dt>Blocked</dt>
                <dd>{todayStats.blocked}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="ag-pipeline ds-panel" aria-labelledby="ag-pipeline-heading">
          <h2 id="ag-pipeline-heading" className="ag-section-title">
            How Wave protects this agent
          </h2>
          <SecurityPipeline compact />
        </section>

        <section className="ag-whats-next ds-panel" aria-labelledby="ag-whats-next-heading">
          <h2 id="ag-whats-next-heading" className="ag-section-kicker">
            What&apos;s next?
          </h2>

          {isProtected ? (
            <>
              <p className="ag-whats-next-desc">
                Your agent is connected and protected. Test an action or review recent activity.
              </p>
              <div className="ag-primary-actions">
                <Link href={testPageHref} className="ds-btn ds-btn-primary">
                  Test an Action →
                </Link>
                <Link href="/audit" className="ds-btn ds-btn-secondary">
                  View Activity →
                </Link>
                <Link href={protectionHref} className="ds-btn ds-btn-secondary">
                  Manage Protection →
                </Link>
              </div>
            </>
          ) : !lifecycle.connectionAcknowledged && !key?.lastUsedAt ? (
            <>
              <p className="ag-whats-next-desc">
                Connect this agent to Wave so we can inspect its actions before they execute.
              </p>
              <div className="ag-primary-actions">
                <Link href={connectHref} className="ds-btn ds-btn-primary">
                  Connect Agent →
                </Link>
                <Link href={protectionHref} className="ds-btn ds-btn-secondary">
                  Configure Protection
                </Link>
              </div>
            </>
          ) : !lifecycle.protectionConfigured ? (
            <>
              <p className="ag-whats-next-desc">
                Set what your agent can do automatically, what needs your approval, and what is
                never allowed.
              </p>
              <div className="ag-primary-actions">
                <Link href={protectionHref} className="ds-btn ds-btn-primary">
                  Configure Protection →
                </Link>
                <Link href={connectHref} className="ds-btn ds-btn-secondary">
                  View Connection
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="ag-whats-next-desc">
                See what Wave does when your agent attempts an important action.
              </p>
              <div className="ag-primary-actions">
                <Link href={testPageHref} className="ds-btn ds-btn-primary">
                  Test an Action →
                </Link>
                <Link href={protectionHref} className="ds-btn ds-btn-secondary">
                  Manage Protection
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="ag-info ds-panel" aria-labelledby="ag-info-heading">
          <h2 id="ag-info-heading" className="ag-section-title">
            Agent information
          </h2>
          <dl className="ag-info-grid">
            <div>
              <dt>Agent name</dt>
              <dd>{summary?.name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{summary?.description}</dd>
            </div>
            <div>
              <dt>Agent type</dt>
              <dd>{summary?.agentType}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {onboarding ? (
                  <span className="ag-status-line">
                    <span aria-hidden="true">{onboarding.statusEmoji}</span>{" "}
                    {summary?.connectionLabel === "Connected"
                      ? onboarding.statusLabel
                      : "Not connected"}
                  </span>
                ) : (
                  summary?.connectionLabel
                )}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{summary?.createdAt}</dd>
            </div>
            {isProtected ? (
              <div>
                <dt>Actions monitored</dt>
                <dd>{summary?.actionsMonitored ?? 0}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {session?.plainKey ? (
          <section className="ag-key ds-panel" aria-labelledby="ag-key-heading">
            <h2 id="ag-key-heading" className="ag-section-title">
              Your connection key
            </h2>
            <p className="ag-key-desc">
              Copy this key now — it will not be shown again. Add it to your agent code to connect
              to Wave.
            </p>
            <p className="ag-key-meta">
              Agent ID: <code className="font-mono">{session.agentId}</code> · Prefix{" "}
              <code className="font-mono">{session.keyPrefix}…</code>
            </p>
            <pre className="ag-key-value">{session.plainKey}</pre>
            <CopyButton text={session.plainKey} label="Copy key" />
          </section>
        ) : null}

        <AgentTryDemoSection
          agentId={agentId}
          agentName={summary?.name ?? agentId}
          templateSlug={session?.templateSlug}
        />

        {onboarding && !isProtected ? (
          <p className="ag-footer-hint">
            <Shield className="inline h-4 w-4 -translate-y-px text-[var(--ds-brand)]" strokeWidth={2} />
            {" "}
            {onboarding.progressLines.join(" · ")}
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}
