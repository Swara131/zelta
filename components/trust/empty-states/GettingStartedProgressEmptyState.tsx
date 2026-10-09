"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { OnboardingProgress } from "@/lib/dashboard/trust-empty-states";

interface GettingStartedProgressEmptyStateProps {
  progress: OnboardingProgress;
  className?: string;
}

export default function GettingStartedProgressEmptyState({
  progress,
  className = "",
}: GettingStartedProgressEmptyStateProps) {
  const { steps, percentComplete, nextStepLabel, nextStepHref } = progress;

  return (
    <section
      className={`te-onboarding ds-panel ${className}`.trim()}
      aria-labelledby="te-onboarding-heading"
    >
      <div className="te-onboarding-head">
        <h2 id="te-onboarding-heading" className="te-onboarding-title">
          Getting started with Wave
        </h2>
        <p className="te-onboarding-percent" aria-live="polite">
          You&apos;re {percentComplete}% done!
        </p>
      </div>

      <div
        className="te-onboarding-progress"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <span className="te-onboarding-progress-fill" style={{ width: `${percentComplete}%` }} />
      </div>

      <ol className="te-onboarding-steps">
        {steps.map((step) => {
          const content = (
            <>
              <span className="te-onboarding-step-icon" aria-hidden="true">
                {step.complete ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-4 w-4" strokeWidth={2} />
                )}
              </span>
              <span className="te-onboarding-step-label">{step.label}</span>
            </>
          );

          const itemClass = [
            "te-onboarding-step",
            step.complete ? "te-onboarding-step-done" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={step.id}>
              {step.href.startsWith("#") ? (
                <a href={step.href} className={itemClass}>
                  {content}
                </a>
              ) : (
                <Link href={step.href} className={itemClass}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <p className="te-onboarding-next">
        Next:{" "}
        {nextStepHref.startsWith("#") ? (
          <a href={nextStepHref} className="te-onboarding-next-link">
            {nextStepLabel}
          </a>
        ) : (
          <Link href={nextStepHref} className="te-onboarding-next-link">
            {nextStepLabel}
          </Link>
        )}
      </p>
    </section>
  );
}
