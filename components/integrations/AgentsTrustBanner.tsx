import { TRUST_BANNER_ITEMS } from "@/lib/integrations/agent-trust-metrics";

export default function AgentsTrustBanner() {
  return (
    <section className="ma-trust-banner" aria-label="Security guarantees">
      <ul className="ma-trust-banner-list">
        {TRUST_BANNER_ITEMS.map((item) => (
          <li key={item.label} className="ma-trust-badge">
            <span className="ma-trust-badge-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
