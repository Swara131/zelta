"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { GettingStartedStep } from "@/lib/dashboard/getting-started-checklist";

interface OverviewGettingStartedChecklistProps {
  steps: GettingStartedStep[];
  currentStepId: string;
}

export default function OverviewGettingStartedChecklist({
  steps,
  currentStepId,
}: OverviewGettingStartedChecklistProps) {
  return (
    <section className="cc-gs-checklist ds-panel" aria-labelledby="cc-gs-heading">
      <h2 id="cc-gs-heading" className="cc-gs-title">
        Getting Started
      </h2>
      <p className="cc-gs-desc">Complete these steps to protect your first agent.</p>

      <ol className="cc-gs-list">
        {steps.map((step) => {
          const isComplete = step.complete;
          const isCurrent = step.id === currentStepId && !isComplete;
          const isUpcoming = !isComplete && !isCurrent;

          const className = [
            "cc-gs-item",
            isComplete ? "cc-gs-item-done" : "",
            isCurrent ? "cc-gs-item-current" : "",
            isUpcoming ? "cc-gs-item-upcoming" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const content = (
            <>
              <span className="cc-gs-icon" aria-hidden="true">
                {isComplete ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-4 w-4" strokeWidth={2} />
                )}
              </span>
              <span className="cc-gs-label">{step.label}</span>
            </>
          );

          return (
            <li key={step.id}>
              {step.href.startsWith("#") ? (
                <a href={step.href} className={className}>
                  {content}
                </a>
              ) : (
                <Link href={step.href} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
