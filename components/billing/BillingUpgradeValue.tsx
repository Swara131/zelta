import { BILLING_UPGRADE_VALUE } from "@/lib/billing/founder-billing-copy";

export default function BillingUpgradeValue() {
  return (
    <section className="bill-upgrade-value ds-panel" aria-labelledby="bill-upgrade-value-heading">
      <h2 id="bill-upgrade-value-heading" className="bill-section-title">
        Upgrade value
      </h2>
      <ul className="bill-upgrade-value-list">
        <li className="bill-upgrade-value-item">
          <span className="bill-upgrade-value-icon" aria-hidden="true">
            💰
          </span>
          <p>{BILLING_UPGRADE_VALUE.roi}</p>
        </li>
        <li className="bill-upgrade-value-item">
          <span className="bill-upgrade-value-icon" aria-hidden="true">
            ⏱️
          </span>
          <p>{BILLING_UPGRADE_VALUE.metric}</p>
        </li>
      </ul>
    </section>
  );
}
