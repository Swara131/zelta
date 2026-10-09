"use client";

import { Check, Loader2 } from "lucide-react";

export interface AgentBuildStep {
  id: string;
  label: string;
}

interface AgentBuildProgressProps {
  title?: string;
  steps: readonly AgentBuildStep[];
  activeIndex: number;
}

export default function AgentBuildProgress({
  title = "Building your agent…",
  steps,
  activeIndex,
}: AgentBuildProgressProps) {
  return (
    <div className="zws-build" role="status" aria-live="polite">
      <p className="zws-build-title">{title}</p>
      <ol className="zws-build-steps">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={step.id}
              className={`zws-build-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
            >
              <span className="zws-build-marker" aria-hidden="true">
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "○"
                )}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
