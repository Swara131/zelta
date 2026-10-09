"use client";

import { X } from "lucide-react";
import type { ApprovalStatus } from "@/lib/approval-types";
import type { ActionReviewView } from "@/lib/approvals/action-review-copy";

interface ApprovalConfirmDialogProps {
  open: boolean;
  action: ApprovalStatus;
  review: ActionReviewView;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ApprovalConfirmDialog({
  open,
  action,
  review,
  loading,
  onClose,
  onConfirm,
}: ApprovalConfirmDialogProps) {
  if (!open || (action !== "approved" && action !== "rejected")) {
    return null;
  }

  const isApprove = action === "approved";
  const title = isApprove ? "Approve this action?" : "Reject this action?";
  const outcome = isApprove ? review.approveOutcome : review.rejectOutcome;

  return (
    <>
      <div
        className="pipeline-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg rounded-2xl ring-1 ring-white/10 sm:inset-x-auto"
        role="dialog"
        aria-labelledby="approval-confirm-title"
        aria-modal="true"
      >
        <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
            <div>
              <p className="ap-confirm-category">{review.categoryLabel}</p>
              <h2
                id="approval-confirm-title"
                className="mt-1 text-lg font-semibold text-zinc-100"
              >
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {review.headline}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <dl className="ap-confirm-summary">
              {review.amount ? (
                <div>
                  <dt>Amount</dt>
                  <dd>{review.amount}</dd>
                </div>
              ) : null}
              {review.customerId || review.customer ? (
                <div>
                  <dt>Customer</dt>
                  <dd>{review.customerId ?? review.customer}</dd>
                </div>
              ) : null}
              {review.reason ? (
                <div>
                  <dt>Reason</dt>
                  <dd>{review.reason}</dd>
                </div>
              ) : null}
            </dl>

            <div
              className={`ap-confirm-outcome ${isApprove ? "ap-confirm-outcome-approve" : "ap-confirm-outcome-reject"}`}
            >
              <p className="ap-confirm-outcome-label">
                {isApprove ? "If you approve" : "If you reject"}
              </p>
              <p className="ap-confirm-outcome-body">{outcome}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/8 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ap-btn ap-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`ap-btn ${isApprove ? "ap-btn-approve" : "ap-btn-reject"}`}
            >
              {loading ? (
                <span className="approval-btn-spinner" aria-hidden="true" />
              ) : null}
              {isApprove ? "Approve Action" : "Reject Action"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
