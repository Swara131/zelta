import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import { DECISION_AGENT_TEMPLATES } from "@/lib/decision-agents/types";

export default function DecisionAgentTemplatesRoute() {
  return (
    <PageShell maxWidth="6xl" className="zdec-page">
      <h1>Multiple Decision Agents — Templates</h1>
      <p className="zdec-lead">Starter examples — each creates a separate decision agent with its own configuration.</p>
      <ul className="zdec-template-grid">
        {DECISION_AGENT_TEMPLATES.map((template) => (
          <li key={template.id}>
            <Link href={`/decision-agents/create?template=${template.id}`} className="zdec-template-card ds-panel">
              <h2>{template.name}</h2>
              <p>{template.purpose}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
