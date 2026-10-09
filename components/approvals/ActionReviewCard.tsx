"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { PendingApproval, ApprovalStatus } from "@/lib/approval-types";
import {
  buildActionReviewDetailFields,
  buildActionReviewView,
} from "@/lib/approvals/action-review-copy";
import ApprovalConfirmDialog from "./ApprovalConfirmDialog";
import RiskScoreBreakdownPanel from "./RiskScoreBreakdownPanel";
import ShadowRiskAssessmentPanel from "./ShadowRiskAssessmentPanel";

interface ActionReviewCardProps {
  approval: PendingApproval;
  index: number;
  highlighted?: boolean;
  onAction: (id: string, action: ApprovalStatus, comment?: string) => void | Promise<void>;
}

function riskClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "ap-risk-high";
    case "medium":
      return "ap-risk-medium";
    default:
      return "ap-risk-low";
  }
}

export default function ActionReviewCard({
  approval,
  index,
  highlighted = false,
  onAction,
}: ActionReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<ApprovalStatus | null>(null);
  const [confirmAction, setConfirmAction] = useState<ApprovalStatus | null>(null);
  const review = buildActionReviewView(approval);
  const detailFields = buildActionReviewDetailFields(approval);
  const isGateway = approval.source === "gateway";

  const handleConfirm = async () => {
    if (!confirmAction || confirmAction === "pending") {
      return;
    }

    setActionLoading(confirmAction);
    try {
      await onAction(approval.id, confirmAction);
      setConfirmAction(null);
    } finally {
      setActionLoading(null);
    }
  };

  const customerDisplay = review.customerId ?? review.customer;

  return (
    <>
      <article
        className={`ap-card ds-panel ${highlighted ? "ap-card-highlighted" : ""}`}
        style={{ animationDelay: `${index * 80}ms` }}
        data-proposal-id={approval.id}
        aria-labelledby={`ap-title-${approval.id}`}
      >
        <div className="ap-card-top">
          <span className="ap-category-badge">{review.categoryLabel}</span>
          <span className={`ap-status-pill ${review.statusLabel === "Waiting for your decision" ? "ap-status-waiting" : ""}`}>
            {review.statusLabel}
          </span>
        </div>

        <p id={`ap-title-${approval.id}`} className="ap-card-headline">
          {review.headline}
        </p>

        <div className="ap-held-banner" role="note">
          <p className="ap-held-title">This action is held for your approval</p>
          <p className="ap-held-meta">
            Requested {review.requestedAt} · Waiting {review.timeWaiting}
          </p>
        </div>

        {review.riskScoreDisplay ? (
          <div className="ap-risk-transparency">
            <p className="ap-risk-transparency-score">{review.riskScoreDisplay}</p>
            {review.riskScoreExplanation && !review.riskScoreBreakdown?.hasWeightedFactors ? (
              <p className="ap-risk-transparency-reason">— {review.riskScoreExplanation}</p>
            ) : null}
          </div>
        ) : null}

        {review.riskScoreBreakdown ? (
          <RiskScoreBreakdownPanel breakdown={review.riskScoreBreakdown} />
        ) : null}

        <dl className="ap-card-facts">
          {review.amount ? (
            <div>
              <dt>Amount</dt>
              <dd>{review.amount}</dd>
            </div>
          ) : null}
          {customerDisplay ? (
            <div>
              <dt>Customer</dt>
              <dd>{customerDisplay}</dd>
            </div>
          ) : null}
          {review.reason ? (
            <div>
              <dt>Reason</dt>
              <dd>{review.reason}</dd>
            </div>
          ) : null}
        </dl>

        <div className="ap-card-guardrails">
          <div className="ap-guardrail-item">
            <span className="ap-guardrail-label">Risk</span>
            <span className={`ap-risk-badge ${riskClass(review.riskLabel)}`}>
              {review.riskLabel.toUpperCase()}
            </span>
          </div>
          <div className="ap-guardrail-item ap-guardrail-policy">
            <span className="ap-guardrail-label">Policy</span>
            <span className="ap-guardrail-value">{review.policySummary}</span>
          </div>
        </div>

        <div className="ap-outcome-preview">
          <div className="ap-outcome-item">
            <span className="ap-outcome-label">If you approve</span>
            <p>{review.approveOutcome}</p>
          </div>
          <div className="ap-outcome-item">
            <span className="ap-outcome-label">If you reject</span>
            <p>{review.rejectOutcome}</p>
          </div>
        </div>

        <div className="ap-card-actions">
          <button
            type="button"
            onClick={() => setConfirmAction("approved")}
            disabled={!!actionLoading}
            className="ap-btn ap-btn-approve"
          >
            {actionLoading === "approved" ? (
              <span className="approval-btn-spinner" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            )}
            Approve anyway
          </button>

          <button
            type="button"
            onClick={() => setConfirmAction("rejected")}
            disabled={!!actionLoading}
            className="ap-btn ap-btn-reject"
          >
            {actionLoading === "rejected" ? (
              <span className="approval-btn-spinner" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            )}
            Reject
          </button>
        </div>

        <button
          type="button"
          className="ap-details-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Hide full details" : "View full details"}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>

        {expanded ? (
          <div className="ap-details-panel">
            <h3 className="ap-detail-panel-title">Full approval details</h3>
            <dl className="ap-detail-grid">
              {detailFields.map((field) => (
                <div key={field.label} className="ap-detail-row">
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>

            <div className="ap-detail-actions">
              <button
                type="button"
                onClick={() => setConfirmAction("approved")}
                disabled={!!actionLoading}
                className="ap-btn ap-btn-approve"
              >
                {actionLoading === "approved" ? (
                  <span className="approval-btn-spinner" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                )}
                Approve anyway
              </button>

              <button
                type="button"
                onClick={() => setConfirmAction("rejected")}
                disabled={!!actionLoading}
                className="ap-btn ap-btn-reject"
              >
                {actionLoading === "rejected" ? (
                  <span className="approval-btn-spinner" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                )}
                Reject
              </button>
            </div>

            {!isGateway ? (
              <div className="ar-legacy-note">
                <p className="text-sm text-[var(--ds-text-secondary)]">{approval.aiExplanation}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onAction(approval.id, "changes_requested")}
                    disabled={!!actionLoading}
                    className="approval-btn approval-btn-changes"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void onAction(approval.id, "escalated")}
                    disabled={!!actionLoading}
                    className="approval-btn approval-btn-escalate"
                  >
                    Escalate
                  </button>
                </div>
              </div>
            ) : null}

            <details className="cp-advanced-setup ap-advanced">
              <summary className="cp-advanced-setup-summary">
                Advanced technical details
                <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </summary>
              <div className="cp-advanced-setup-body space-y-3">
                <p>
                  Proposal ID: <code className="font-mono text-xs">{approval.id}</code>
                </p>
                {approval.actionHash ? (
                  <p>
                    Action hash:{" "}
                    <code className="break-all font-mono text-xs">{approval.actionHash}</code>
                  </p>
                ) : null}
                {approval.actionPayload ? (
                  <>
                    <p>Action payload:</p>
                    <pre className="ab-spec-json">
                      {JSON.stringify(approval.actionPayload, null, 2)}
                    </pre>
                  </>
                ) : null}
                {approval.matchedPolicies?.length ? (
                  <>
                    <p>Matched policies:</p>
                    <pre className="ab-spec-json">
                      {JSON.stringify(approval.matchedPolicies, null, 2)}
                    </pre>
                  </>
                ) : null}
                {approval.shadowRisk ? (
                  <ShadowRiskAssessmentPanel shadowRisk={approval.shadowRisk} />
                ) : null}
              </div>
            </details>
          </div>
        ) : null}
      </article>

      <ApprovalConfirmDialog
        open={confirmAction !== null}
        action={confirmAction ?? "pending"}
        review={review}
        loading={!!actionLoading}
        onClose={() => {
          if (!actionLoading) {
            setConfirmAction(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
