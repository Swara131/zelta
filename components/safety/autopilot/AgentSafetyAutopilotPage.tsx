"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { PROTECTION_PRESETS } from "@/lib/safety/autopilot/presets";
import { estimateLimitRiskLabel } from "@/lib/safety/autopilot/evaluate-safety-policy";
import type {
  ApprovalRuleKey,
  ProtectionMode,
  SafetyAutopilotSnapshot,
  SafetyIncidentRecord,
  ToolPermissionLevel,
} from "@/lib/safety/autopilot/types";
import { formatRelativeTime } from "@/lib/audit/activity-copy";

const PERMISSION_LABELS: Record<ToolPermissionLevel, string> = {
  disabled: "Disabled",
  read_only: "Read only",
  draft_only: "Draft only",
  ask_approval: "Ask for approval",
  automatic: "Automatically act",
};

const RULE_LABELS: Record<ApprovalRuleKey, string> = {
  send_message: "Send email/message",
  publish_content: "Publish content",
  delete_data: "Delete data",
  process_payments: "Process payments/refunds",
  change_production_code: "Change production code",
  export_customer_data: "Export customer data",
  access_secrets: "Access secrets",
};

function statusLabel(status: string): string {
  switch (status) {
    case "protected":
      return "Protected";
    case "needs_attention":
      return "Needs Attention";
    case "high_risk":
      return "High Risk";
    default:
      return status;
  }
}

function ScoreHero({
  snapshot,
  onFixAll,
  fixing,
}: {
  snapshot: SafetyAutopilotSnapshot;
  onFixAll: () => void;
  fixing: boolean;
}) {
  const { evaluation, policy } = snapshot;
  const StatusIcon =
    evaluation.status === "protected"
      ? ShieldCheck
      : evaluation.status === "high_risk"
        ? ShieldAlert
        : Shield;

  return (
    <section className="zsafety-hero ds-panel" aria-labelledby="zsafety-score-title">
      <div className="zsafety-hero-main">
        <div className="zsafety-score-ring" data-status={evaluation.status}>
          <StatusIcon className="zsafety-score-icon" aria-hidden="true" />
          <span className="zsafety-score-value">{evaluation.score}</span>
          <span className="zsafety-score-max">/ 100</span>
        </div>
        <div>
          <h2 id="zsafety-score-title" className="zsafety-section-title">
            Safety score
          </h2>
          <p className={`zsafety-status-badge zsafety-status-${evaluation.status}`}>
            {statusLabel(evaluation.status)}
          </p>
          <p className="zsafety-muted">
            Based on your saved protection settings — not a guarantee of security.
          </p>
          {policy.lastCheckedAt ? (
            <p className="zsafety-muted">
              Last checked{" "}
              <time dateTime={policy.lastCheckedAt}>
                {formatRelativeTime(policy.lastCheckedAt)}
              </time>
            </p>
          ) : null}
        </div>
      </div>

      {evaluation.factors.length > 0 ? (
        <div className="zsafety-factors">
          <h3 className="zsafety-subhead">Top factors</h3>
          <ul>
            {evaluation.factors.map((factor) => (
              <li key={factor.id}>
                <span
                  className={
                    factor.direction === "negative" ? "zsafety-factor-bad" : "zsafety-factor-good"
                  }
                >
                  {factor.direction === "negative" ? "−" : "+"}
                  {factor.impact}
                </span>
                {factor.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.recommendations.length > 0 ? (
        <button
          type="button"
          className="ds-btn ds-btn-primary"
          disabled={fixing}
          onClick={onFixAll}
        >
          {fixing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Fix all recommended issues
        </button>
      ) : null}
    </section>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="zsafety-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="zsafety-modal ds-panel"
        role="alertdialog"
        aria-labelledby="zsafety-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="zsafety-modal-title">{title}</h3>
        <p>{message}</p>
        <div className="zsafety-modal-actions">
          <button type="button" className="ds-btn ds-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`ds-btn ${destructive ? "ds-btn-danger" : "ds-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncidentDrawer({
  incident,
  onClose,
}: {
  incident: SafetyIncidentRecord;
  onClose: () => void;
}) {
  return (
    <div className="zsafety-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="zsafety-drawer ds-panel"
        role="dialog"
        aria-labelledby="zsafety-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="zsafety-drawer-header">
          <h3 id="zsafety-drawer-title">{incident.title}</h3>
          <button type="button" className="zsafety-icon-btn" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className={`zsafety-severity zsafety-severity-${incident.severity}`}>
          {incident.severity}
        </p>
        <p>{incident.explanation}</p>
        <dl className="zsafety-detail-grid">
          <div>
            <dt>Time</dt>
            <dd>
              <time dateTime={incident.createdAt}>
                {new Date(incident.createdAt).toLocaleString()}
              </time>
            </dd>
          </div>
          {incident.relatedTool ? (
            <div>
              <dt>Tool</dt>
              <dd>{incident.relatedTool}</dd>
            </div>
          ) : null}
          {incident.runId ? (
            <div>
              <dt>Run ID</dt>
              <dd>{incident.runId.slice(0, 8)}…</dd>
            </div>
          ) : null}
          <div>
            <dt>Action taken</dt>
            <dd>{incident.actionTaken}</dd>
          </div>
        </dl>
        {incident.isSample ? (
          <p className="zsafety-sample-badge">Sample data — connect your agent runtime for live events.</p>
        ) : null}
      </aside>
    </div>
  );
}

export default function AgentSafetyAutopilotPage() {
  const params = useParams();
  const slug = typeof params.agentId === "string" ? params.agentId : "";

  const [snapshot, setSnapshot] = useState<SafetyAutopilotSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);

  const [severityFilter, setSeverityFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncidentRecord | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [pendingMode, setPendingMode] = useState<ProtectionMode | null>(null);
  const [pendingAutomatic, setPendingAutomatic] = useState<{
    toolId: string;
    level: ToolPermissionLevel;
  } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (severityFilter) qs.set("severity", severityFilter);
      if (toolFilter) qs.set("tool", toolFilter);
      const url = `/api/v1/agents/${encodeURIComponent(slug)}/safety${qs.toString() ? `?${qs}` : ""}`;
      const response = await fetch(url);
      const payload = (await response.json()) as SafetyAutopilotSnapshot & {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Failed to load safety settings.");
      }
      setSnapshot(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load safety settings.");
    } finally {
      setLoading(false);
    }
  }, [slug, severityFilter, toolFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!slug) return;
      setSaving(true);
      try {
        const response = await fetch(`/api/v1/agents/${encodeURIComponent(slug)}/safety`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as SafetyAutopilotSnapshot & {
          success?: boolean;
          error?: string;
          requiresConfirmation?: boolean;
        };
        if (response.status === 409 && payload.requiresConfirmation) {
          return payload;
        }
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error ?? "Update failed.");
        }
        setSnapshot(payload);
        showToast("Safety settings saved.");
        return payload;
      } finally {
        setSaving(false);
      }
    },
    [slug, showToast]
  );

  const handleModeChange = async (mode: ProtectionMode) => {
    const result = await patch({ section: "protection_mode", mode });
    if (result && "requiresConfirmation" in result && result.requiresConfirmation) {
      setPendingMode(mode);
      setConfirmDialog({
        title: "Increase protection risk?",
        message:
          "This preset reduces approvals and may allow more autonomous actions. Confirm only if you understand the tradeoffs.",
        confirmLabel: "Switch anyway",
        destructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          void patch({ section: "protection_mode", mode, confirmRiskIncrease: true });
          setPendingMode(null);
        },
      });
    }
  };

  const handlePermissionChange = async (toolId: string, permissionLevel: ToolPermissionLevel) => {
    const result = await patch({ section: "tool_permission", toolId, permissionLevel });
    if (result && "requiresConfirmation" in result && result.requiresConfirmation) {
      setPendingAutomatic({ toolId, level: permissionLevel });
      setConfirmDialog({
        title: "Allow automatic actions?",
        message:
          "This tool can perform high-impact actions without approval. Misconfiguration could lead to unwanted sends, charges, or data changes.",
        confirmLabel: "Enable automatic",
        destructive: true,
        onConfirm: () => {
          setConfirmDialog(null);
          void patch({
            section: "tool_permission",
            toolId,
            permissionLevel,
            confirmAutomatic: true,
          });
          setPendingAutomatic(null);
        },
      });
    }
  };

  const handleFixAll = async () => {
    if (!slug) return;
    setFixing(true);
    try {
      const response = await fetch(`/api/v1/agents/${encodeURIComponent(slug)}/safety/fix-all`, {
        method: "POST",
      });
      const payload = (await response.json()) as SafetyAutopilotSnapshot & {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? "Failed to apply fixes.");
      }
      setSnapshot(payload);
      showToast("Recommended fixes applied.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Fix failed.");
    } finally {
      setFixing(false);
    }
  };

  const handleFixOne = async (recommendationId: string) => {
    if (!slug) return;
    const response = await fetch(`/api/v1/agents/${encodeURIComponent(slug)}/safety/fix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId }),
    });
    const payload = (await response.json()) as SafetyAutopilotSnapshot & {
      success?: boolean;
      error?: string;
    };
    if (response.ok && payload.success !== false) {
      setSnapshot(payload);
      showToast("Fix applied.");
    }
  };

  const handleEmergency = (action: string, title: string, message: string) => {
    setConfirmDialog({
      title,
      message,
      confirmLabel: "Confirm",
      destructive: true,
      onConfirm: () => {
        setConfirmDialog(null);
        void (async () => {
          const response = await fetch(
            `/api/v1/agents/${encodeURIComponent(slug)}/safety/emergency`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, confirm: true }),
            }
          );
          const payload = (await response.json()) as SafetyAutopilotSnapshot & {
            success?: boolean;
            error?: string;
          };
          if (response.ok && payload.success !== false) {
            setSnapshot(payload);
            showToast("Emergency action recorded.");
            void load();
          } else {
            showToast(payload.error ?? "Action failed.");
          }
        })();
      },
    });
  };

  const limitRisk = useMemo(
    () => (snapshot ? estimateLimitRiskLabel(snapshot.limits) : null),
    [snapshot]
  );

  if (!slug) {
    return (
      <PageShell maxWidth="6xl">
        <p>Agent not found.</p>
      </PageShell>
    );
  }

  if (loading && !snapshot) {
    return (
      <PageShell maxWidth="6xl" className="zsafety-page">
        <div className="zsafety-skeleton">
          <div className="zsafety-skeleton-hero ds-panel" />
          <div className="zsafety-skeleton-grid">
            <div className="ds-panel zsafety-skeleton-block" />
            <div className="ds-panel zsafety-skeleton-block" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !snapshot) {
    return (
      <PageShell maxWidth="6xl" className="zsafety-page">
        <p className="zsafety-error" role="alert">
          {error ?? "Could not load safety settings."}
        </p>
        <button type="button" className="ds-btn ds-btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </PageShell>
    );
  }

  const isPaused = snapshot.agent.displayStatus === "paused";

  return (
    <PageShell maxWidth="6xl" className="zsafety-page">
      <header className="zsafety-header">
        <Link
          href={`/agents/${encodeURIComponent(slug)}`}
          className="zsafety-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to agent
        </Link>
        <div className="zsafety-header-main">
          <Shield className="zsafety-header-icon" aria-hidden="true" />
          <div>
            <h1 className="ds-page-title">Safety Autopilot</h1>
            <p className="ds-page-description">
              Configure, monitor, and control safety for{" "}
              <strong>{snapshot.agent.name}</strong> in plain language.
            </p>
          </div>
        </div>
      </header>

      {toast ? (
        <p className="zsafety-toast" role="status">
          {toast}
        </p>
      ) : null}

      <ScoreHero snapshot={snapshot} onFixAll={() => void handleFixAll()} fixing={fixing} />

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-mode-title">
        <h2 id="zsafety-mode-title" className="zsafety-section-title">
          Protection mode
        </h2>
        <p className="zsafety-muted">Choose how much autonomy this agent has by default.</p>
        <div className="zsafety-mode-grid">
          {(Object.keys(PROTECTION_PRESETS) as ProtectionMode[]).map((mode) => {
            const preset = PROTECTION_PRESETS[mode];
            const active = snapshot.policy.protectionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={`zsafety-mode-card ${active ? "zsafety-mode-active" : ""}`}
                disabled={saving}
                aria-pressed={active}
                onClick={() => void handleModeChange(mode)}
              >
                <span className="zsafety-mode-label">{preset.label}</span>
                <span className="zsafety-mode-summary">{preset.summary}</span>
                <span className="zsafety-mode-tradeoff">{preset.tradeoff}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-tools-title">
        <h2 id="zsafety-tools-title" className="zsafety-section-title">
          Tool permissions
        </h2>
        <p className="zsafety-muted">
          Least privilege by default — no integration receives automatic write access unless you
          explicitly allow it.
        </p>
        <div className="zsafety-table-wrap">
          <table className="zsafety-table">
            <thead>
              <tr>
                <th scope="col">Integration</th>
                <th scope="col">Permission</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.permissions.map((perm) => (
                <tr
                  key={perm.toolId}
                  className={perm.isHighRisk ? "zsafety-row-risk" : undefined}
                >
                  <td>
                    {perm.toolLabel}
                    {perm.isHighRisk ? (
                      <span className="zsafety-risk-tag">High risk</span>
                    ) : null}
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`perm-${perm.toolId}`}>
                      Permission for {perm.toolLabel}
                    </label>
                    <select
                      id={`perm-${perm.toolId}`}
                      className="zsafety-select"
                      value={perm.revokedAt ? "disabled" : perm.permissionLevel}
                      disabled={saving}
                      onChange={(e) =>
                        void handlePermissionChange(
                          perm.toolId,
                          e.target.value as ToolPermissionLevel
                        )
                      }
                    >
                      {(Object.keys(PERMISSION_LABELS) as ToolPermissionLevel[]).map((level) => (
                        <option key={level} value={level}>
                          {PERMISSION_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-rules-title">
        <h2 id="zsafety-rules-title" className="zsafety-section-title">
          Approval rules
        </h2>
        <div className="zsafety-rules-list">
          {snapshot.approvalRules.map((rule) => (
            <label key={rule.ruleKey} className="zsafety-rule-row">
              <input
                type="checkbox"
                checked={rule.enabled}
                disabled={saving}
                onChange={(e) =>
                  void patch({
                    section: "approval_rules",
                    rules: [{ ruleKey: rule.ruleKey, enabled: e.target.checked }],
                  })
                }
              />
              <span>{RULE_LABELS[rule.ruleKey]}</span>
              {rule.thresholdValue != null ? (
                <input
                  type="number"
                  className="zsafety-threshold-input"
                  aria-label={`Threshold for ${RULE_LABELS[rule.ruleKey]}`}
                  value={rule.thresholdValue}
                  disabled={saving || !rule.enabled}
                  onChange={(e) =>
                    void patch({
                      section: "approval_rules",
                      rules: [
                        {
                          ruleKey: rule.ruleKey,
                          enabled: rule.enabled,
                          thresholdValue: Number(e.target.value),
                          thresholdUnit: rule.thresholdUnit,
                        },
                      ],
                    })
                  }
                />
              ) : null}
            </label>
          ))}
        </div>
        {snapshot.policySummary.length > 0 ? (
          <div className="zsafety-policy-summary">
            <h3 className="zsafety-subhead">Policy summary</h3>
            <ul>
              {snapshot.policySummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-limits-title">
        <h2 id="zsafety-limits-title" className="zsafety-section-title">
          Budget & execution limits
        </h2>
        {limitRisk ? (
          <p className={`zsafety-limit-risk zsafety-limit-risk-${limitRisk}`} role="status">
            Estimated risk: {limitRisk} — unusually high limits increase blast radius if the agent
            misbehaves.
          </p>
        ) : null}
        <div className="zsafety-limits-grid">
          {(
            [
              ["maxCostPerRunUsd", "Max cost per run (USD)"],
              ["dailySpendingCapUsd", "Daily spending cap (USD)"],
              ["maxToolCallsPerRun", "Max tool calls per run"],
              ["maxExecutionTimeSeconds", "Max execution time (seconds)"],
              ["maxRetries", "Max retries"],
              ["maxMessagesPerRun", "Max emails/messages per run"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="zsafety-limit-field">
              <span>{label}</span>
              <input
                type="number"
                min={0}
                value={snapshot.limits[field] ?? ""}
                disabled={saving}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : Number(e.target.value);
                  setSnapshot({
                    ...snapshot,
                    limits: { ...snapshot.limits, [field]: value },
                  });
                }}
                onBlur={() =>
                  void patch({
                    section: "execution_limits",
                    ...snapshot.limits,
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-data-title">
        <h2 id="zsafety-data-title" className="zsafety-section-title">
          Data & prompt protection
        </h2>
        <p className="zsafety-untrusted-note">
          External web pages, uploaded files, and tool outputs are treated as untrusted content.
        </p>
        {(
          [
            ["promptInjectionDefense", "Prompt injection defense", "Heuristics flag likely instruction-override patterns — not foolproof against all attacks."],
            ["secretDetection", "Secret detection & redaction", "Scans outputs for API keys and tokens before display or storage."],
            ["piiDetection", "PII detection & masking", "Masks common personal identifiers in logs and UI."],
            ["blockPromptExtraction", "Block system prompt extraction", "Blocks obvious attempts to reveal hidden instructions."],
            ["restrictSensitiveKb", "Restrict sensitive knowledge-base docs", "Limits retrieval of documents marked sensitive."],
          ] as const
        ).map(([key, label, help]) => (
          <label key={key} className="zsafety-toggle-row">
            <input
              type="checkbox"
              checked={snapshot.policy.dataProtection[key]}
              disabled={saving}
              onChange={(e) =>
                void patch({
                  section: "data_protection",
                  ...snapshot.policy.dataProtection,
                  [key]: e.target.checked,
                })
              }
            />
            <span>
              <strong>{label}</strong>
              <span className="zsafety-muted">{help}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="zsafety-section ds-panel" aria-labelledby="zsafety-activity-title">
        <h2 id="zsafety-activity-title" className="zsafety-section-title">
          Live safety activity
        </h2>
        {snapshot.hasSampleIncidents ? (
          <p className="zsafety-sample-badge">Showing sample data — no live incidents recorded yet.</p>
        ) : null}
        <div className="zsafety-filters">
          <label>
            Severity
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter by severity"
            >
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="blocked">Blocked</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Tool
            <input
              type="search"
              placeholder="e.g. Gmail"
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              aria-label="Filter by tool"
            />
          </label>
        </div>
        <ul className="zsafety-activity-list">
          {snapshot.incidents.map((incident) => (
            <li key={incident.id}>
              <button
                type="button"
                className="zsafety-activity-item"
                onClick={() => setSelectedIncident(incident)}
              >
                <span className={`zsafety-severity-dot zsafety-severity-${incident.severity}`} />
                <span>
                  <strong>{incident.title}</strong>
                  <span className="zsafety-muted">
                    {incident.relatedTool ?? "General"} ·{" "}
                    <time dateTime={incident.createdAt}>
                      {formatRelativeTime(incident.createdAt)}
                    </time>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="zsafety-section ds-panel zsafety-emergency" aria-labelledby="zsafety-emergency-title">
        <h2 id="zsafety-emergency-title" className="zsafety-section-title">
          <Zap className="inline h-5 w-5" aria-hidden="true" /> Emergency controls
        </h2>
        <p className="zsafety-muted">
          Only authorized workspace members can use these controls. Each action is recorded in the
          audit timeline.
        </p>
        <div className="zsafety-emergency-grid">
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={() =>
              handleEmergency(
                isPaused ? "resume_agent" : "pause_agent",
                isPaused ? "Resume agent?" : "Pause agent?",
                isPaused
                  ? "The agent will resume scheduled and manual runs."
                  : "The agent will stop running until you resume it."
              )
            }
          >
            {isPaused ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
            {isPaused ? "Resume agent" : "Pause agent"}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={() =>
              handleEmergency(
                "revoke_permissions",
                "Revoke all integration permissions?",
                "Every integration will be set to Disabled until you reconfigure permissions."
              )
            }
          >
            Revoke all permissions
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-danger"
            onClick={() =>
              handleEmergency(
                "kill_active_runs",
                "Kill active runs?",
                "Running and pending runs will be cancelled immediately. In-progress actions may not roll back."
              )
            }
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Kill active runs
          </button>
        </div>
      </section>

      {snapshot.evaluation.recommendations.length > 0 ? (
        <section className="zsafety-section ds-panel" aria-labelledby="zsafety-rec-title">
          <h2 id="zsafety-rec-title" className="zsafety-section-title">
            Safety recommendations
          </h2>
          <ul className="zsafety-rec-list">
            {snapshot.evaluation.recommendations.map((rec) => (
              <li key={rec.id}>
                <span>{rec.message}</span>
                <button
                  type="button"
                  className="ds-btn ds-btn-ghost ds-btn-sm"
                  onClick={() => void handleFixOne(rec.id)}
                >
                  Fix
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selectedIncident ? (
        <IncidentDrawer incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
      ) : null}

      {confirmDialog ? (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          destructive={confirmDialog.destructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => {
            setConfirmDialog(null);
            setPendingMode(null);
            setPendingAutomatic(null);
          }}
        />
      ) : null}

      {(pendingMode || pendingAutomatic) && saving ? (
        <p className="zsafety-muted">
          <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
        </p>
      ) : null}
    </PageShell>
  );
}
