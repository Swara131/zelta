"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CancelBillingModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
}

export default function CancelBillingModal({
  open,
  loading,
  error,
  onClose,
  onConfirm,
}: CancelBillingModalProps) {
  const [feedback, setFeedback] = useState("");

  if (!open) return null;

  const handleClose = () => {
    if (loading) return;
    setFeedback("");
    onClose();
  };

  return (
    <>
      <div
        className="pipeline-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-4 top-[12%] z-50 mx-auto max-w-md rounded-2xl ring-1 ring-white/10 sm:inset-x-auto"
        role="dialog"
        aria-labelledby="cancel-billing-title"
        aria-modal="true"
      >
        <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
            <div>
              <h2 id="cancel-billing-title" className="text-lg font-semibold text-zinc-100">
                We&apos;re sorry to see you go
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Before you cancel, tell us why:
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              aria-label="Close"
              disabled={loading}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <label className="block">
              <span className="sr-only">Cancellation feedback</span>
              <textarea
                className="ds-input min-h-[7rem] w-full resize-y"
                placeholder="What could we have done better?"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={loading}
              />
            </label>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Keep subscription
              </button>
              <button
                type="button"
                className="ds-btn bill-btn-danger"
                disabled={loading}
                onClick={() => onConfirm(feedback)}
              >
                {loading ? "Cancelling…" : "Cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
