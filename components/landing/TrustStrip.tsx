const ITEMS = [
  "From prompt to protected workflow",
  "Human approval for high-impact actions",
  "Built-in permissions, limits, and audit trails",
];

export default function TrustStrip() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {ITEMS.map((item) => (
          <p key={item} className="text-sm font-medium text-[var(--text-primary)]">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}
