"use client";

import Link from "next/link";
import { ArrowRight, Plus, Link2 } from "lucide-react";
import { CTA } from "@/lib/ux/cta-labels";

interface AgentsBottomCTAProps {
  onCreateAgent?: () => void;
  createHref?: string;
}

export default function AgentsBottomCTA({
  onCreateAgent,
  createHref = "/agents/create",
}: AgentsBottomCTAProps) {
  return (
    <section className="ma-bottom-cta ds-panel" aria-labelledby="ma-bottom-cta-heading">
      <h2 id="ma-bottom-cta-heading" className="sr-only">
        Get started with Wave
      </h2>

      <div className="ma-bottom-cta-grid">
        <div className="ma-bottom-cta-block">
          <p className="ma-bottom-cta-copy">New to Wave? Start with a guided setup</p>
          {onCreateAgent ? (
            <button
              type="button"
              className="ds-btn ds-btn-primary ma-bottom-cta-btn group"
              onClick={onCreateAgent}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {CTA.createAgent}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          ) : (
            <Link href={createHref} className="ds-btn ds-btn-primary ma-bottom-cta-btn group">
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {CTA.createAgent}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          )}
        </div>

        <div className="ma-bottom-cta-divider" aria-hidden="true" />

        <div className="ma-bottom-cta-block">
          <p className="ma-bottom-cta-copy">Already have an agent? Connect it in 3 minutes</p>
          <Link href="/onboarding/connect" className="ds-btn ds-btn-secondary ma-bottom-cta-btn group">
            <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {CTA.connectExistingAgent}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
