"use client";

import { Eye, ShieldAlert, ShieldCheck, Clock, AlertCircle, Sparkles } from "lucide-react";
import SeverityBadge from "@/components/risk/SeverityBadge";
import type { ShadowRiskDisplayView } from "@/lib/ui/shadow-risk-display";
import type { PolicyDecisionOutcome } from "@/lib/gateway/policy/types";

interface ShadowRiskAssessmentPanelProps {
  shadowRisk: ShadowRiskDisplayView;
}

const GATEWAY_DECISION_STYLES: Record<
  PolicyDecisionOutcome,
  { label: string; className: string }
> = {
  ALLOW: {
    label: "ALLOW",
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  },
  REVIEW: {
    label: "REVIEW",
    className: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  },
  BLOCK: {
    label: "BLOCK",
    className: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  },
};

function DecisionBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gateway" | "shadow";
}) {
  const isGateway = tone === "gateway";
  return (
    <div
      className={`rounded-xl border p-3 ${
        isGateway
          ? "border-white/10 bg-white/3"
          : "border-indigo-400/20 bg-indigo-500/8"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-sm font-bold ${
          isGateway ? "text-zinc-100" : "text-indigo-300"
        }`}
      >
        {value}
      </p>
      {!isGateway && (
        <p className="mt-1 text-[10px] text-zinc-500">Advisory only — did not control execution</p>
      )}
    </div>
  );
}

function StatusBanner({ shadowRisk }: { shadowRisk: ShadowRiskDisplayView }) {
  if (shadowRisk.status === "pending") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-zinc-500/20 bg-zinc-500/8 px-3 py-2 text-sm text-zinc-400">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        Shadow risk assessment is pending or not yet available for this proposal.
      </div>
    );
  }

  if (shadowRisk.status === "failed") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-200/90">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        Shadow classifier failed
        {shadowRisk.failureCode ? ` (${shadowRisk.failureCode})` : ""}.
        {shadowRisk.failureMessage ? ` ${shadowRisk.failureMessage}` : ""} Gateway decisions were
        unaffected.
      </div>
    );
  }

  return null;
}

export default function ShadowRiskAssessmentPanel({
  shadowRisk,
}: ShadowRiskAssessmentPanelProps) {
  if (shadowRisk.status === "none") {
    return null;
  }

  const gatewayStyle = shadowRisk.gatewayDecision
    ? GATEWAY_DECISION_STYLES[shadowRisk.gatewayDecision]
    : null;

  return (
    <section
      className="mt-5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 p-4"
      aria-label="Shadow risk assessment"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          Shadow Risk Assessment
        </div>
        <span className="rounded-full border border-indigo-400/25 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
          Shadow mode
        </span>
        {shadowRisk.classifierStatus && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {shadowRisk.classifierStatus}
          </span>
        )}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-zinc-500">
        The shadow classifier provides observational risk analysis only. The gateway decision below
        is authoritative for execution.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {gatewayStyle && shadowRisk.gatewayDecision && (
          <div className={`rounded-xl border p-3 ${gatewayStyle.className}`}>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-80">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Actual gateway decision
            </div>
            <p className="mt-1 font-mono text-lg font-bold">{gatewayStyle.label}</p>
            <p className="mt-1 text-[10px] opacity-80">Controls execution and tokens</p>
          </div>
        )}

        {shadowRisk.shadowRecommendedDecision ? (
          <DecisionBadge
            label="Shadow risk recommendation"
            value={shadowRisk.shadowRecommendedDecision}
            tone="shadow"
          />
        ) : shadowRisk.status === "pending" ? (
          <DecisionBadge label="Shadow risk recommendation" value="Pending" tone="shadow" />
        ) : null}
      </div>

      <StatusBanner shadowRisk={shadowRisk} />

      {shadowRisk.status === "completed" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {shadowRisk.riskLevel && (
              <SeverityBadge severity={shadowRisk.riskLevel} size="sm" />
            )}
            {shadowRisk.score !== null && (
              <span className="text-sm text-zinc-300">
                Score{" "}
                <span className="font-semibold text-zinc-100">{shadowRisk.score}</span>
                /100
              </span>
            )}
            {shadowRisk.confidence !== null && (
              <span className="text-sm text-zinc-400">
                Confidence {Math.round(shadowRisk.confidence * 100)}%
              </span>
            )}
          </div>

          {shadowRisk.reasons.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                Reasons
              </div>
              <ul className="space-y-1.5">
                {shadowRisk.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shadowRisk.signalLabels.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                Detected signals
              </div>
              <div className="flex flex-wrap gap-2">
                {shadowRisk.signalLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
            {shadowRisk.modelProvider && shadowRisk.modelName && (
              <span>
                Model {shadowRisk.modelProvider}/{shadowRisk.modelName}
              </span>
            )}
            {shadowRisk.classifierVersion && (
              <span>Classifier {shadowRisk.classifierVersion}</span>
            )}
            {shadowRisk.latencyMs !== null && <span>{shadowRisk.latencyMs}ms latency</span>}
            {shadowRisk.assessedAt && (
              <span>
                Assessed{" "}
                {new Date(shadowRisk.assessedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
