import Link from "next/link";
import { MARKETPLACE_TEMPLATES } from "@/lib/templates/marketplace-catalog";

const FEATURED = [
  "lead-researcher",
  "customer-support-agent",
  "meeting-notes-agent",
  "invoice-extractor",
  "ai-safety-monitor",
];

export default function LandingTemplateShowcase() {
  const templates = FEATURED.map((slug) =>
    MARKETPLACE_TEMPLATES.find((item) => item.slug === slug)
  ).filter(Boolean);

  return (
    <section className="landing-section" id="templates">
      <div className="mx-auto max-w-6xl">
        <p className="landing-kicker">Templates</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Start from a proven agent.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {templates.map((template) => (
            <article key={template!.slug} className="landing-card p-4">
              <h3 className="text-sm font-semibold">{template!.name}</h3>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{template!.shortDescription}</p>
            </article>
          ))}
        </div>
        <Link href="/dashboard/templates" className="mt-6 inline-block text-sm font-semibold text-[var(--primary)]">
          View all templates
        </Link>
      </div>
    </section>
  );
}
