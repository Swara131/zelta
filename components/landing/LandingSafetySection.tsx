const POINTS = [
  {
    title: "Scoped tool permissions",
    body: "Each tool can be disabled, read-only, draft-only, approval-required, or automatic — automatic still cannot skip server checks.",
  },
  {
    title: "Approval checkpoints",
    body: "High-impact sends, refunds, and record changes wait for a person when you require it.",
  },
  {
    title: "Spending and execution limits",
    body: "Cap cost, tool calls, and run time so an agent cannot loop forever.",
  },
  {
    title: "Audit trail",
    body: "Changes, tests, approvals, and blocks are recorded. Sensitive content stays out of the UI.",
  },
  {
    title: "Pause / kill switch",
    body: "Stop a workflow or revoke a connector without tearing down the agent.",
  },
];

export default function LandingSafetySection() {
  return (
    <section className="landing-section bg-[var(--surface)]" id="safety">
      <div className="mx-auto max-w-6xl">
        <p className="landing-kicker">Safety</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Autonomy with control.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {POINTS.map((point) => (
            <article key={point.title} className="landing-card p-5">
              <h3 className="text-base font-semibold">{point.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{point.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
