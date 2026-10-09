"use client";

import Link from "next/link";

const CONNECT_FEATURES = [
  "Policy checks",
  "Risk analysis",
  "Human approvals",
  "Audit logs",
] as const;

export default function AgentsPathSelector() {
  return (
    <section className="ma-path-selector" aria-labelledby="ma-path-heading">
      <p className="ma-path-intro">Two ways to protect your AI agents</p>
      <h2 id="ma-path-heading" className="ma-path-heading">
        Choose how you want to work
      </h2>

      <div className="ma-path-grid">
        <article
          className="ma-path-card ma-path-card-create"
          style={{ animationDelay: "0ms" }}
        >
          <span className="ma-path-icon" aria-hidden="true">
            📝
          </span>
          <div className="ma-path-body">
            <h3 className="ma-path-card-title">Create Agent</h3>
            <p className="ma-path-card-desc">
              Describe what your agent should do in one sentence. Wave configures the rest
              automatically.
            </p>
            <Link href="/agents/create" className="ma-path-btn ma-path-btn-blue">
              + Create Agent →
            </Link>
          </div>
        </article>

        <article
          className="ma-path-card ma-path-card-protect"
          style={{ animationDelay: "200ms" }}
        >
          <span className="ma-path-icon" aria-hidden="true">
            🔗
          </span>
          <div className="ma-path-body">
            <h3 className="ma-path-card-title">Connect &amp; Protect</h3>
            <p className="ma-path-card-desc">
              Add an existing agent to the Wave gateway. Instant policy checks and approval
              workflows.
            </p>
            <ul className="ma-path-features">
              {CONNECT_FEATURES.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <Link href="/onboarding/connect" className="ma-path-btn ma-path-btn-green">
              Connect &amp; Protect →
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
