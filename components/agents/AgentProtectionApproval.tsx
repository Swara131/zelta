"use client";

import { useState } from "react";
import { Check, Loader2, Shield, X } from "lucide-react";
import { riskLevelLabel } from "@/lib/agents/protection/summaries";
import type { RiskSeverity } from "@/lib/risk-types";

export interface AgentProtectionApprovalProps {
  proposalId: string;
  runId?: string | null;
  summary: string;
  why: string;
  riskLevel?: RiskSeverity;
  details?: Record<string, unknown>;
  onResolved?: (result: {
    decision: "approved" | "rejected";
    runSummary?: string | null;
  }) => void;
}

function formatDetailValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

export default function AgentProtectionApproval({
  proposalId,
  summary,
  why,
  riskLevel = "medium",
  details,
  onResolved,
}: AgentProtectionApprovalProps) {
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  const handleDecision = async (decision: "approved" | "rejected") => {
    setLoading(decision);
    setError(null);

    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(proposalId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: {
          runtimeResume?: {
            runSummary?: string | null;
            runStatus?: string;
          };
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save your decision.");
      }

      setResolved(decision);
      onResolved?.({
        decision,
        runSummary: payload.result?.runtimeResume?.runSummary ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="asw-protection-card ds-panel" aria-live="polite">
      <div className="asw-protection-header">
        <Shield className="h-5 w-5" aria-hidden="true" />
        <div>
          <p className="asw-protection-kicker">Your agent needs your approval</p>
          <p className="asw-protection-risk">{riskLevelLabel(riskLevel)}</p>
        </div>
      </div>

      <div className="asw-protection-body">
        <p className="asw-protection-summary">{summary}</p>
        <p className="asw-protection-why">
          <strong>Why:</strong> {why}
        </p>

        {details && Object.keys(details).length > 0 ? (
          <dl className="asw-protection-details">
            {Object.entries(details).map(([key, value]) =>
              value == null ? null : (
                <div key={key}>
                  <dt>{key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
                  <dd>{formatDetailValue(value)}</dd>
                </div>
              )
            )}
          </dl>
        ) : null}
      </div>

      {error ? <p className="asw-protection-error">{error}</p> : null}

      {resolved ? (
        <p className="asw-protection-resolved">
          {resolved === "approved"
            ? "Approved. Wave is continuing your agent run."
            : "Rejected. This action was stopped and logged."}
        </p>
      ) : (
        <div className="asw-protection-actions">
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={loading !== null}
            onClick={() => void handleDecision("approved")}
          >
            {loading === "approved" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            Approve
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            disabled={loading !== null}
            onClick={() => void handleDecision("rejected")}
          >
            {loading === "rejected" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4" aria-hidden="true" />
            )}
            Reject
          </button>
        </div>
      )}
    </section>
  );
}
