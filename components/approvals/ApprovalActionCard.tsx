"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { PendingApproval, ApprovalStatus } from "@/lib/approval-types";
import {
  buildActionReviewDetailFields,
  buildActionReviewView,
  buildApprovalRiskTransparency,
  describeActionIntent,
} from "@/lib/approvals/action-review-copy";
import RiskScoreBreakdownPanel from "./RiskScoreBreakdownPanel";
import { FLOW_LOADING } from "@/lib/ux/flow-copy";

export type ApprovalResolution =
  | { status: "pending" }
  | {
      status: "approved";
      decidedAt: string;
      executed?: boolean;
      executionError?: string;
      runStatus?: string;
    }
  | { status: "rejected"; decidedAt: string; reason?: string };

interface ApprovalActionCardProps {
  approval: PendingApproval;
  index: number;
  highlighted?: boolean;
  resolution?: ApprovalResolution;
  saving?: boolean;
  onAction: (id: string, action: ApprovalStatus, comment?: string) => void | Promise<void>;
}

function formatDecisionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ApprovalActionCard({
  approval,
  index,
  highlighted = false,
  resolution = { status: "pending" },
  saving = false,
  onAction,
}: ApprovalActionCardProps) {
  const [actionLoading, setActionLoading] = useState<ApprovalStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isBusy = saving || !!actionLoading;
  const review = buildActionReviewView(approval);
  const detailFields = buildActionReviewDetailFields(approval);
  const { riskScoreDisplay, riskScoreBreakdown } = buildApprovalRiskTransparency(approval);
  const isResolved = resolution.status !== "pending";
  const actionStatus =
    resolution.status === "approved"
      ? resolution.executed === false
        ? "Approved — execution failed"
        : "Approved"
      : resolution.status === "rejected"
        ? "Denied"
        : "PENDING";

  const handleClick = async (action: ApprovalStatus) => {
    setActionLoading(action);
    try {
      await onAction(approval.id, action, action === "rejected" ? "Manual rejection" : undefined);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <article
      className={`ap-card ds-panel ap-action-card ap-approval-card ${highlighted ? "ap-card-highlighted" : ""} ${isResolved ? "ap-action-card-resolved" : ""}`}
      style={{ animationDelay: `${index * 80}ms` }}
      data-proposal-id={approval.id}
      aria-labelledby={`ap-action-title-${approval.id}`}
    >
      {!isResolved ? (
        <div className="ap-approval-needed-banner" role="status">
          PENDING APPROVAL
        </div>
      ) : null}

      <dl className="ap-approval-summary">
        <div>
          <dt>Agent</dt>
          <dd>{review.agentName}</dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd id={`ap-action-title-${approval.id}`}>{describeActionIntent(approval)}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{review.riskLabel}</dd>
        </div>
        <div>
          <dt>Why Wave paused this</dt>
          <dd>{review.whyPaused}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{review.timeWaiting}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{review.expiresAt}</dd>
        </div>
      </dl>

      {riskScoreDisplay ? (
        <div className="ap-risk-transparency">
          <p className="ap-risk-transparency-score">{riskScoreDisplay}</p>
        </div>
      ) : null}

      {riskScoreBreakdown ? (
        <RiskScoreBreakdownPanel breakdown={riskScoreBreakdown} compact />
      ) : null}

      <div className="ap-action-status-row">
        <span className="ap-action-status-label">Status:</span>
        <span
          className={`ap-action-status-value ${
            resolution.status === "approved"
              ? "ap-action-status-executed"
              : resolution.status === "rejected"
                ? "ap-action-status-blocked"
                : "ap-action-status-pending"
          }`}
        >
          {actionStatus}
        </span>
      </div>

      {resolution.status === "approved" ? (
        <div className="ap-action-resolution ap-action-resolution-approved">
          <p>✓ Approved at {formatDecisionTime(resolution.decidedAt)}</p>
          {resolution.executed === false ? (
            <p>Execution failed{resolution.executionError ? `: ${resolution.executionError}` : "."}</p>
          ) : (
            <p>✓ Action executed{resolution.runStatus ? ` (${resolution.runStatus})` : ""}</p>
          )}
        </div>
      ) : null}

      {resolution.status === "rejected" ? (
        <div className="ap-action-resolution ap-action-resolution-rejected">
          <p>✕ Action denied at {formatDecisionTime(resolution.decidedAt)}</p>
          <p>The protected action was not executed.</p>
        </div>
      ) : null}

      {isBusy && !isResolved ? (
        <p className="ap-action-saving" role="status">
          {FLOW_LOADING.savingApproval}
        </p>
      ) : null}

      <button
        type="button"
        className="ap-btn ap-btn-secondary"
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? "Hide details" : "View details"}
      </button>

      {detailsOpen ? (
        <dl className="ap-approval-details">
          {detailFields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
          {approval.toolName ? (
            <div>
              <dt>Tool</dt>
              <dd>{approval.toolName}</dd>
            </div>
          ) : null}
          {approval.matchedPolicies?.[0] ? (
            <div>
              <dt>Policy</dt>
              <dd>
                {approval.matchedPolicies[0].name}: {approval.matchedPolicies[0].reason}
              </dd>
            </div>
          ) : null}
          {approval.actionPayload ? (
            <div>
              <dt>Inputs</dt>
              <dd>
                <pre>{JSON.stringify(approval.actionPayload, null, 2)}</pre>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="ap-card-actions">
        <button
          type="button"
          onClick={() => void handleClick("rejected")}
          disabled={isResolved || isBusy}
          className="ap-btn ap-btn-reject"
        >
          {actionLoading === "rejected" ? (
            <span className="approval-btn-spinner" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          )}
          Deny
        </button>
        <button
          type="button"
          onClick={() => void handleClick("approved")}
          disabled={isResolved || isBusy}
          className="ap-btn ap-btn-approve"
        >
          {actionLoading === "approved" || (saving && !isResolved) ? (
            <span className="approval-btn-spinner" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          )}
          {isResolved && resolution.status === "approved" ? "Approved" : "Approve"}
        </button>
      </div>
    </article>
  );
}
