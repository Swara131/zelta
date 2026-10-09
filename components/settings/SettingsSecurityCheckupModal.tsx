"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import type { SecurityCheckupStep } from "@/lib/settings/trust-settings";

interface SettingsSecurityCheckupModalProps {
  open: boolean;
  steps: SecurityCheckupStep[];
  onClose: () => void;
}

export default function SettingsSecurityCheckupModal({
  open,
  steps,
  onClose,
}: SettingsSecurityCheckupModalProps) {
  if (!open) return null;

  const completedCount = steps.filter((step) => step.done).length;

  return (
    <div className="st-checkup-overlay" role="presentation" onClick={onClose}>
      <div
        className="st-checkup-modal ds-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-checkup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="st-checkup-head">
          <div>
            <h2 id="st-checkup-title" className="st-checkup-title">
              Security checkup
            </h2>
            <p className="st-checkup-subtitle">
              {completedCount} of {steps.length} recommendations complete
            </p>
          </div>
          <button type="button" className="st-checkup-close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <ol className="st-checkup-steps">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={`st-checkup-step ${step.done ? "st-checkup-step-done" : ""}`}
            >
              <span className="st-checkup-step-num" aria-hidden="true">
                {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="st-checkup-step-title">{step.title}</p>
                <p className="st-checkup-step-desc">{step.description}</p>
                {step.href && step.actionLabel ? (
                  <Link href={step.href} className="st-checkup-step-link" onClick={onClose}>
                    {step.actionLabel}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="st-checkup-actions">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
