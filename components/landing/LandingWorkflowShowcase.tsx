"use client";

import { useReducedMotion } from "framer-motion";

const NODES = [
  { label: "New lead received", tone: "is-trigger" },
  { label: "Enrich profile", tone: "is-tool" },
  { label: "Check CRM", tone: "is-tool" },
  { label: "AI qualification", tone: "is-ai" },
  { label: "Draft outreach", tone: "is-ai" },
  { label: "Human approval", tone: "is-approval" },
  { label: "Send email", tone: "is-tool" },
  { label: "Log result", tone: "is-safety" },
];

export default function LandingWorkflowShowcase() {
  const reduce = useReducedMotion();

  return (
    <section className="landing-section bg-[var(--surface)]" id="workflow">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="landing-kicker">Interactive showcase</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">See every step before it runs.</h2>
          <p className="mt-3 max-w-xl text-[var(--text-secondary)]">
            Trigger, AI, tools, logic, and approval nodes stay visually distinct. Dangerous actions sit
            behind a checkpoint.
          </p>
          <ol className="mt-8 grid gap-2 sm:grid-cols-2">
            {NODES.map((node, index) => (
              <li key={node.label} className="flex items-center gap-2">
                <span className={`landing-node ${node.tone}`}>{node.label}</span>
                {!reduce && index < NODES.length - 1 ? (
                  <span className="hero-flow-dot hidden sm:block" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        <aside className="landing-card p-5">
          <h3 className="text-sm font-semibold">Safety controls</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
            <li>Gmail: Draft only</li>
            <li>Send email: Approval required</li>
            <li>Daily limit: 50 emails</li>
            <li>Prompt injection protection: On</li>
          </ul>
          <p className="mt-4 text-xs text-[var(--text-tertiary,var(--text-secondary))]">
            Sample controls for this mockup. Live agents use your Safety Autopilot settings.
          </p>
        </aside>
      </div>
    </section>
  );
}
