"use client";

import Link from "next/link";

interface OverviewAgentCTAProps {
  onCreateAgent?: () => void;
  createHref?: string;
  prominent?: boolean;
}

export default function OverviewAgentCTA({
  onCreateAgent,
  createHref = "/agents/create",
  prominent = true,
}: OverviewAgentCTAProps) {
  const createContent = (
    <>
      <span className="cc-hero-cta-icon" aria-hidden="true">
        ✨
      </span>
      <span className="cc-hero-cta-text">
        <span className="cc-hero-cta-label">Create New Agent</span>
        <span className="cc-hero-cta-sub">Describe what your agent should do</span>
      </span>
    </>
  );

  return (
    <section
      id="cc-hero-cta"
      className={`cc-hero-cta ${prominent ? "cc-hero-cta-prominent" : ""}`}
      aria-labelledby="cc-hero-cta-heading"
    >
      <h2 id="cc-hero-cta-heading" className="cc-hero-cta-headline">
        Ready to build or connect an agent?
      </h2>

      <div className="cc-hero-cta-actions">
        {onCreateAgent ? (
          <button
            type="button"
            className="cc-hero-cta-btn cc-hero-cta-btn-primary"
            onClick={onCreateAgent}
          >
            {createContent}
          </button>
        ) : (
          <Link href={createHref} className="cc-hero-cta-btn cc-hero-cta-btn-primary">
            {createContent}
          </Link>
        )}

        <Link href="/dashboard/templates" className="cc-hero-cta-btn cc-hero-cta-btn-secondary">
          <span className="cc-hero-cta-icon" aria-hidden="true">
            ✨
          </span>
          <span className="cc-hero-cta-text">
            <span className="cc-hero-cta-label">Start from template</span>
            <span className="cc-hero-cta-sub">50 ready-made agents with safety defaults</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
