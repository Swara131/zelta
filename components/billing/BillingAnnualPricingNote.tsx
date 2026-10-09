import { ANNUAL_PRICING_BENEFITS } from "@/lib/billing/founder-billing-copy";
import type { BillingInterval } from "@/lib/billing-types";

interface BillingAnnualPricingNoteProps {
  interval: BillingInterval;
}

export default function BillingAnnualPricingNote({
  interval,
}: BillingAnnualPricingNoteProps) {
  if (interval !== "yearly") {
    return null;
  }

  return (
    <aside className="bill-annual-note ds-panel" aria-labelledby="bill-annual-note-heading">
      <h3 id="bill-annual-note-heading" className="bill-annual-note-title">
        Why annual pricing?
      </h3>
      <ul className="bill-annual-note-list">
        {ANNUAL_PRICING_BENEFITS.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
    </aside>
  );
}
