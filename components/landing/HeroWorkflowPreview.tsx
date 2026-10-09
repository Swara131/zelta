"use client";

import { useReducedMotion } from "framer-motion";

const STEPS = [
  { label: "Trigger", tone: "is-trigger" },
  { label: "Research leads", tone: "is-tool" },
  { label: "Score lead", tone: "is-ai" },
  { label: "Draft email", tone: "is-ai" },
  { label: "Approval", tone: "is-approval" },
  { label: "Send", tone: "is-tool" },
];

export default function HeroWorkflowPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="landing-card p-5">
      <label className="ds-label" htmlFor="hero-prompt-preview">
        Prompt
      </label>
      <p id="hero-prompt-preview" className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--text-primary)]">
        Create an agent that qualifies leads and drafts personalized outreach.
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        Generated workflow
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {STEPS.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2">
            <span className={`landing-node ${step.tone}`}>{step.label}</span>
            {index < STEPS.length - 1 ? (
              <span className={reduce ? "text-[var(--border)]" : "hero-flow-dot"} aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-[var(--cyan-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        Safety checkpoint: send email only after approval.
      </p>
    </div>
  );
}
