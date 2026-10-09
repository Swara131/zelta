import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface AgentSetupNextStepsProps {
  agentId: string;
}

const STEPS = [
  {
    icon: "⚙️",
    title: "Fine-tune policy",
    description: "Adjust thresholds and approval rules",
    href: "/risk",
    cta: "Configure",
  },
  {
    icon: "📊",
    title: "View activity log",
    description: "See actions as they run",
    href: "/audit",
    cta: "Monitor",
  },
] as const;

export default function AgentSetupNextSteps({}: AgentSetupNextStepsProps) {
  return (
    <section className="asp-card asp-next" aria-labelledby="asp-next-heading">
      <h2 id="asp-next-heading" className="asp-card-title">
        What&apos;s next?
      </h2>
      <ul className="asp-next-list">
        {STEPS.map((step) => (
          <li key={step.title}>
            <Link href={step.href} className="asp-next-card">
              <span className="asp-next-icon" aria-hidden="true">
                {step.icon}
              </span>
              <div className="asp-next-body">
                <p className="asp-next-title">{step.title}</p>
                <p className="asp-next-desc">{step.description}</p>
              </div>
              <span className="asp-next-cta">
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
