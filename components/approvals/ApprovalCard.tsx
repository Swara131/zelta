"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Building2,
  Server,
  Users,
  Scale,
  Lightbulb,
  Clock,
  User,
  Bot,
  Check,
  X,
  RefreshCw,
  ArrowUpRight,
  MessageSquare,
  Wrench,
  Hash,
  Shield,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import SeverityBadge from "@/components/risk/SeverityBadge";
import PriorityBadge from "./PriorityBadge";
import ConfidenceScore from "./ConfidenceScore";
import ApprovalTimeline from "./ApprovalTimeline";
import ApprovalHistory from "./ApprovalHistory";
import ShadowRiskAssessmentPanel from "./ShadowRiskAssessmentPanel";
import type { PendingApproval, ApprovalStatus } from "@/lib/approval-types";

interface ApprovalCardProps {
  approval: PendingApproval;
  index: number;
  highlighted?: boolean;
  onAction: (id: string, action: ApprovalStatus, comment?: string) => void | Promise<void>;
}

function MetaBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="approval-meta-block rounded-xl bg-white/2 p-4 ring-1 ring-white/5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </div>
      {children}
    </div>
  );
}

function getSlaStatus(deadline: string) {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (diff < 0) return { label: "SLA Breached", urgent: true, color: "#ff4769" };
  if (hours < 2) return { label: `${hours}h ${mins}m remaining`, urgent: true, color: "#ff8c00" };
  return { label: `${hours}h ${mins}m remaining`, urgent: false, color: "#71717a" };
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApprovalCard({
  approval,
  index,
  highlighted = false,
  onAction,
}: ApprovalCardProps) {
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<ApprovalStatus | null>(null);
  const sla = getSlaStatus(approval.slaDeadline);
  const isGateway = approval.source === "gateway";

  const handleAction = async (action: ApprovalStatus) => {
    setActionLoading(action);
    try {
      await onAction(approval.id, action, comment || undefined);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <article
      className={`approval-card ds-panel overflow-hidden transition-shadow ${
        highlighted ? "ring-2 ring-indigo-400/30 shadow-lg shadow-indigo-500/10" : ""
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
      data-proposal-id={approval.id}
    >
      {/* Top accent by severity */}
      <div
        className="h-1"
        style={{
          background:
            approval.riskSeverity === "critical"
              ? "linear-gradient(90deg, #ff4769, #ff8c00)"
              : approval.riskSeverity === "high"
                ? "linear-gradient(90deg, #ff8c00, #ffb900)"
                : approval.riskSeverity === "medium"
                  ? "linear-gradient(90deg, #ffb900, #818cf8)"
                  : "linear-gradient(90deg, #00bcf2, #34d399)",
        }}
      />

      <div className="p-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={approval.riskSeverity} />
              <PriorityBadge priority={approval.priority} />
              <span className="font-mono text-[11px] text-zinc-600">{approval.id}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-100">
              {approval.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" strokeWidth={2} />
                {approval.agentId}
              </span>
              {isGateway && approval.toolName && (
                <span className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                  {approval.toolName}
                </span>
              )}
              {isGateway && approval.actionType && (
                <span className="font-mono text-[11px] text-zinc-600">
                  {approval.actionType}
                </span>
              )}
              {!isGateway && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" strokeWidth={2} />
                  {approval.assignee}
                </span>
              )}
              {isGateway && approval.submittedAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  {formatTimestamp(approval.submittedAt)}
                </span>
              )}
              {!isGateway && (
                <span
                  className="flex items-center gap-1.5 font-medium"
                  style={{ color: sla.color }}
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  {sla.label}
                </span>
              )}
            </div>
          </div>

          <ConfidenceScore score={approval.confidenceScore} />
        </div>

        {isGateway && approval.actionHash && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <Hash className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="font-semibold uppercase tracking-wider">Action Hash</span>
            <code className="break-all font-mono text-[11px] text-zinc-400">
              {approval.actionHash}
            </code>
          </div>
        )}

        {/* AI Explanation — highlighted */}
        <div className="approval-ai-block mt-6 rounded-xl border border-indigo-400/15 bg-indigo-500/6 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            AI Explanation
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{approval.aiExplanation}</p>
        </div>

        {isGateway && approval.actionPayload && (
          <details className="approval-ai-block mt-4 rounded-xl border border-white/10 bg-white/2 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-3.5 w-3.5" />
              Action Payload (JSON)
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(approval.actionPayload, null, 2)}
            </pre>
          </details>
        )}

        {isGateway && (approval.matchedPolicies?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/6 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              <Shield className="h-3.5 w-3.5" strokeWidth={2} />
              Matched Policies
            </div>
            <ul className="space-y-2">
              {approval.matchedPolicies!.map((policy) => (
                <li key={policy.policyId} className="text-sm text-zinc-300">
                  <span className="font-medium text-zinc-100">{policy.name}</span>
                  <span className="mx-2 font-mono text-[11px] text-zinc-500">
                    {policy.decision}
                  </span>
                  <span className="text-zinc-400">— {policy.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isGateway && (approval.aiRiskReasons?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-xl border border-rose-400/15 bg-rose-500/6 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
              AI Risk Reasons
            </div>
            <ul className="space-y-1.5">
              {approval.aiRiskReasons!.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isGateway && approval.shadowRisk && (
          <ShadowRiskAssessmentPanel shadowRisk={approval.shadowRisk} />
        )}

        {/* Detail grid */}
        {!isGateway && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <MetaBlock icon={Building2} label="Business Justification">
            <p className="text-sm leading-relaxed text-zinc-400">
              {approval.businessJustification}
            </p>
          </MetaBlock>

          <MetaBlock icon={Scale} label="Compliance Impact">
            <p className="text-sm leading-relaxed text-zinc-400">
              {approval.complianceImpact}
            </p>
          </MetaBlock>

          <MetaBlock icon={Server} label="Affected Systems">
            <ul className="space-y-1.5">
              {approval.affectedSystems.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="h-1 w-1 rounded-full bg-indigo-400" />
                  {s}
                </li>
              ))}
            </ul>
          </MetaBlock>

          <MetaBlock icon={Users} label="Affected Users">
            <ul className="space-y-1.5">
              {approval.affectedUsers.map((u) => (
                <li key={u} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="h-1 w-1 rounded-full bg-violet-400" />
                  {u}
                </li>
              ))}
            </ul>
          </MetaBlock>
        </div>
        )}

        {/* Recommended action */}
        {!isGateway && (
        <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-500/6 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
            Recommended Action
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            {approval.recommendedAction}
          </p>
        </div>
        )}

        {/* Timeline */}
        {!isGateway && (
        <div className="mt-6">
          <ApprovalTimeline events={approval.timeline} />
        </div>
        )}

        {/* Comment */}
        <div className="mt-6">
          <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
            Comment
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note to your decision…"
              aria-label="Approval comment"
              className="ds-input flex-1"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleAction("approved")}
            disabled={!!actionLoading}
            className="approval-btn approval-btn-approve inline-flex items-center gap-2"
          >
            {actionLoading === "approved" ? (
              <span className="approval-btn-spinner" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            )}
            Approve
          </button>

          <button
            type="button"
            onClick={() => handleAction("rejected")}
            disabled={!!actionLoading}
            className="approval-btn approval-btn-reject inline-flex items-center gap-2"
          >
            {actionLoading === "rejected" ? (
              <span className="approval-btn-spinner" />
            ) : (
              <X className="h-4 w-4" strokeWidth={2.5} />
            )}
            Reject
          </button>

          {!isGateway && (
          <>
          <button
            type="button"
            onClick={() => handleAction("changes_requested")}
            disabled={!!actionLoading}
            className="approval-btn approval-btn-changes inline-flex items-center gap-2"
          >
            {actionLoading === "changes_requested" ? (
              <span className="approval-btn-spinner" />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
            )}
            Request Changes
          </button>

          <button
            type="button"
            onClick={() => handleAction("escalated")}
            disabled={!!actionLoading}
            className="approval-btn approval-btn-escalate inline-flex items-center gap-2"
          >
            {actionLoading === "escalated" ? (
              <span className="approval-btn-spinner" />
            ) : (
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            )}
            Escalate
          </button>
          </>
          )}
        </div>

        {/* History */}
        {!isGateway && (
        <ApprovalHistory entries={approval.history} />
        )}
      </div>
    </article>
  );
}
