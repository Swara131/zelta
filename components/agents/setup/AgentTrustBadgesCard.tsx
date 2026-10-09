const TRUST_ITEMS = [
  { icon: "⚙️", label: "Policy engine active" },
  { icon: "🧠", label: "Risk classifier monitoring" },
  { icon: "👤", label: "Human approval gate ready" },
  { icon: "📝", label: "Audit log enabled" },
  { icon: "🔐", label: "One-time execution tokens" },
] as const;

export default function AgentTrustBadgesCard() {
  return (
    <section className="asp-card asp-trust" aria-labelledby="asp-trust-heading">
      <h2 id="asp-trust-heading" className="asp-card-title">
        This Agent is Protected by Wave
      </h2>
      <ul className="asp-trust-list">
        {TRUST_ITEMS.map((item, index) => (
          <li
            key={item.label}
            className="asp-trust-item asp-trust-item-enter"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span className="asp-trust-check" aria-hidden="true">
              ✓
            </span>
            <span className="asp-trust-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
