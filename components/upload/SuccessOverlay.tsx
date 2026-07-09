"use client";

import { Check } from "lucide-react";

interface SuccessOverlayProps {
  filename: string;
  onDismiss: () => void;
}

export default function SuccessOverlay({ filename, onDismiss }: SuccessOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
      role="dialog"
      aria-label="Upload successful"
    >
      <div
        className="glass-strong success-pop mx-4 max-w-sm rounded-2xl p-8 text-center shadow-2xl shadow-indigo-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <div className="success-ring absolute inset-0 rounded-full border-2 border-emerald-400/50" />
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-10 w-10"
              aria-hidden="true"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="check-draw"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-zinc-100">Upload complete</h3>
        <p className="mt-2 text-sm text-zinc-400">
          <span className="font-medium text-zinc-300">{filename}</span> has been
          queued for analysis.
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-6 py-2.5 text-sm font-medium text-emerald-400 ring-1 ring-emerald-400/25 transition-all hover:bg-emerald-500/25"
        >
          <Check className="h-4 w-4" strokeWidth={2} />
          Continue
        </button>
      </div>
    </div>
  );
}
