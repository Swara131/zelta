"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import {
  formatComparisonWinner,
  WHY_ZELTA_COMPARISON_ROWS,
  WHY_ZELTA_HEADLINE,
  WHY_ZELTA_LEAD,
  WHY_ZELTA_TESTIMONIALS,
  winnerAriaLabel,
} from "@/lib/marketing/why-zelta-copy";

export default function WhyZeltaPage() {
  return (
    <PageShell maxWidth="6xl" className="wz-page">
      <PageHeader
        icon={Sparkles}
        title={WHY_ZELTA_HEADLINE}
        description={WHY_ZELTA_LEAD}
        actions={
          <Link href="/agents/create" className="ds-btn ds-btn-primary">
            Start in 2 minutes
          </Link>
        }
      />

      <section className="wz-comparison ds-panel" aria-labelledby="wz-comparison-heading">
        <div className="wz-comparison-head">
          <h2 id="wz-comparison-heading" className="wz-section-title">
            Feature comparison
          </h2>
          <p className="wz-section-lead">
            What you get with typical agent-governance tools vs Wave.
          </p>
        </div>

        <div className="wz-comparison-wrap overflow-x-auto">
          <table className="wz-comparison-table">
            <thead>
              <tr>
                <th scope="col" className="wz-col-feature">
                  Feature
                </th>
                <th scope="col">Others</th>
                <th scope="col" className="wz-col-zelta">
                  Wave
                </th>
                <th scope="col">Winner</th>
              </tr>
            </thead>
            <tbody>
              {WHY_ZELTA_COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="wz-col-feature">
                    {row.feature}
                  </th>
                  <td>{row.others}</td>
                  <td className="wz-col-zelta">{row.zelta}</td>
                  <td>
                    <span
                      className={`wz-winner wz-winner-${row.winner}`}
                      aria-label={winnerAriaLabel(row.winner)}
                    >
                      {formatComparisonWinner(row.winner)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wz-highlights" aria-label="Wave advantages">
        <div className="wz-highlight-card ds-panel">
          <p className="wz-highlight-label">Setup</p>
          <p className="wz-highlight-value">2 minutes</p>
          <p className="wz-highlight-copy">One step to protected agents — not a week of integration calls.</p>
        </div>
        <div className="wz-highlight-card ds-panel">
          <p className="wz-highlight-label">Intelligence</p>
          <p className="wz-highlight-value">AI risk scoring</p>
          <p className="wz-highlight-copy">Explainable scores and a learning loop that improves your policies.</p>
        </div>
        <div className="wz-highlight-card ds-panel">
          <p className="wz-highlight-label">India-first</p>
          <p className="wz-highlight-value">₹3k / month</p>
          <p className="wz-highlight-copy">WhatsApp approvals and INR pricing built for how you actually work.</p>
        </div>
      </section>

      <section className="wz-testimonials" aria-labelledby="wz-testimonials-heading">
        <h2 id="wz-testimonials-heading" className="wz-section-title">
          What founders say
        </h2>
        <ul className="wz-testimonial-list">
          {WHY_ZELTA_TESTIMONIALS.map((item) => (
            <li key={item.id} className="wz-testimonial-card ds-panel">
              <blockquote className="wz-testimonial-quote">
                <p>&ldquo;{item.quote}&rdquo;</p>
              </blockquote>
              <footer className="wz-testimonial-attribution">— {item.attribution}</footer>
            </li>
          ))}
        </ul>
      </section>

      <section className="wz-cta ds-panel" aria-labelledby="wz-cta-heading">
        <h2 id="wz-cta-heading" className="wz-cta-title">
          Ready to switch?
        </h2>
        <p className="wz-cta-lead">
          Connect an agent, set protection rules, and approve actions from email or WhatsApp — today.
        </p>
        <div className="wz-cta-actions">
          <Link href="/agents/create" className="ds-btn ds-btn-primary">
            Create your first agent
          </Link>
          <Link href="/billing" className="ds-btn ds-btn-secondary">
            View pricing
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
