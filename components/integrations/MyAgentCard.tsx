"use client";

import Link from "next/link";
import { Lock, Shield, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { PendingApproval } from "@/lib/approval-types";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { FounderAgentCard } from "@/lib/dashboard/founder-copy";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import {
  getAgentDisplayStatus,
  getAgentProtectHref,
  getAgentWorkspaceHref,
  isStandaloneAgent,
} from "@/lib/agents/agent-mode";
import AgentSetupProgress from "@/components/agents/AgentSetupProgress";
import AgentTrustTooltip from "@/components/trust/AgentTrustTooltip";

interface MyAgentCardProps {
  agent: FounderAgentCard;
  sourceBadge?: { origin: string; label: string } | null;
  apiKey: AgentApiKeyRecord | null;
  approvals: PendingApproval[];
  auditEntries: AuditTimelineEntry[];
  progressRefresh: number;
  variant?: "default" | "example";
  expanded: boolean;
  revoking: boolean;
  onToggleExpand: () => void;
  onProgressChange: () => void;
  onDelete?: () => void;
  formatDate: (value: string | null) => string;
}

export default function MyAgentCard({
  agent,
  sourceBadge,
  apiKey,
  progressRefresh,
  variant = "default",
  expanded,
  revoking,
  onToggleExpand,
  onProgressChange,
  onDelete,
  formatDate,
}: MyAgentCardProps) {
  const isExample = variant === "example";
  const session = loadCreatedAgentSession(agent.id);
  const lifecycle = loadAgentLifecycle(agent.id);
  const display = getAgentDisplayStatus(lifecycle, apiKey, agent.sourceLabel);
  const standalone = isStandaloneAgent(lifecycle);
  const workspaceHref = getAgentWorkspaceHref(agent.id);
  const protectHref = getAgentProtectHref(agent.id);

  if (isExample) {
    return (
      <article
        id={`agent-${agent.id}`}
        className="ma-agent-card ma-agent-card-example ds-panel"
      >
        <span className="ma-agent-sample-badge">Sample</span>
        <div className="ma-agent-example-header">
          <div className="min-w-0">
            <h3 className="ma-agent-name">{agent.name}</h3>
            <p className="ma-agent-purpose-label">Purpose</p>
            <p className="ma-agent-purpose">&ldquo;{agent.description}&rdquo;</p>
          </div>
        </div>
        <p className="ma-agent-example-helper">
          These are safe, sandboxed examples. Delete them when ready to go live.
        </p>
        <div className="ma-agent-actions ma-agent-actions-example">
          <Button
            variant="danger"
            size="md"
            icon={Trash2}
            loading={revoking}
            onClick={() => onDelete?.()}
            className="ma-agent-delete-example"
          >
            Delete example agent
          </Button>
        </div>
      </article>
    );
  }

  return (
    <AgentTrustTooltip>
      <article id={`agent-${agent.id}`} className="ma-agent-card ma-agent-card-v2 ds-panel">
        <div className="ma-agent-v2-head">
          <div>
            <h3 className="ma-agent-name">{agent.name}</h3>
            <p className="ma-agent-type">
              <span className="ma-agent-source-badge">
                ●{" "}
                {sourceBadge?.label ??
                  (agent.source === "zelta"
                    ? "Wave"
                    : agent.source === "demo"
                      ? "Sample"
                      : "External")}
              </span>
            </p>
          </div>
          <span
            className={`ma-agent-runtime-badge ${
              display.runtimeStatus === "active"
                ? "ma-agent-runtime-badge-active"
                : "ma-agent-runtime-badge-paused"
            }`}
          >
            {display.runtimeStatus === "active" ? "Active" : "Paused"}
          </span>
        </div>

        <p className="ma-agent-purpose">&ldquo;{agent.description}&rdquo;</p>

        <div className="ma-agent-status-row">
          <span className={`ma-agent-pill ${display.created ? "ma-agent-pill-on" : ""}`}>
            Created
          </span>
          <span className={`ma-agent-pill ${display.connected ? "ma-agent-pill-on" : ""}`}>
            Connected
          </span>
          <span className={`ma-agent-pill ${display.protected ? "ma-agent-pill-protected" : ""}`}>
            {display.protected ? (
              <>
                <Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                Protected
              </>
            ) : (
              "Unprotected"
            )}
          </span>
        </div>

        {!standalone && display.showSetupIncomplete ? (
          <AgentSetupProgress
            agentId={agent.id}
            agentName={agent.name}
            apiKey={apiKey}
            refreshKey={progressRefresh}
            showLiveBanner={false}
            onProgressChange={onProgressChange}
          />
        ) : null}

        <div className="ma-agent-actions ma-agent-actions-v2">
          <Link href={workspaceHref} className="ds-btn ds-btn-primary ds-btn-sm">
            Open Setup
          </Link>
          {!display.protected ? (
            <Link href={protectHref} className="ds-btn ds-btn-secondary ds-btn-sm">
              <Shield className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Protect with Wave
            </Link>
          ) : null}
          <button
            type="button"
            className="ds-btn ds-btn-ghost ds-btn-sm"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            Details
          </button>
        </div>

        {expanded && apiKey ? (
          <div className="ma-agent-detail">
            <p className="text-xs text-[var(--ds-text-tertiary)]">
              Key prefix: <code className="font-mono">{apiKey.keyPrefix}…</code> · Last used:{" "}
              {formatDate(apiKey.lastUsedAt)}
            </p>
            {session?.spec ? (
              <p className="text-xs text-[var(--ds-text-tertiary)] mt-2">
                Mode: {standalone ? "Create & Use" : "Connect & Protect"}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                loading={revoking}
                onClick={() => onDelete?.()}
              >
                Revoke key
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    </AgentTrustTooltip>
  );
}
