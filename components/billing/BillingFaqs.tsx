import { BILLING_FAQ_ITEMS } from "@/lib/billing/founder-billing-copy";

export default function BillingFaqs() {
  return (
    <section className="bill-faqs ds-panel" aria-labelledby="bill-faqs-heading">
      <h2 id="bill-faqs-heading" className="bill-section-title">
        Transparent billing
      </h2>
      <ul className="bill-faqs-list">
        {BILLING_FAQ_ITEMS.map((item) => (
          <li key={item} className="bill-faqs-item">
            <span className="bill-faqs-check" aria-hidden="true">
              ✓
            </span>
            {item.includes("sales@zelta.com") ? (
              <span>
                Need a custom plan?{" "}
                <a href="mailto:sales@zelta.com" className="st-trust-footer-link">
                  Email sales@zelta.com
                </a>
              </span>
            ) : (
              <span>{item}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
