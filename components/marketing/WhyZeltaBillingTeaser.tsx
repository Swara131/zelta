import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function WhyZeltaBillingTeaser() {
  return (
    <section className="bill-why-zelta-teaser ds-panel" aria-labelledby="bill-why-zelta-heading">
      <div className="bill-why-zelta-teaser-copy">
        <h2 id="bill-why-zelta-heading" className="bill-section-title bill-why-zelta-title">
          <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Why Wave vs Others
        </h2>
        <p className="bill-section-desc">
          2-minute setup, AI risk scoring, WhatsApp approvals, policy learning, and ₹3k India
          pricing — see how Wave compares to typical agent-governance tools.
        </p>
      </div>
      <Link href="/why-zelta" className="ds-btn ds-btn-secondary bill-why-zelta-link">
        See full comparison
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
