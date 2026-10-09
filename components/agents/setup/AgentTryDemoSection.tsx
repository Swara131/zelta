"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import TemplateSimulationModal from "@/components/agents/setup/TemplateSimulationModal";

interface AgentTryDemoSectionProps {
  agentId: string;
  agentName: string;
  templateSlug?: string | null;
  onTestPassed?: () => void;
}

export default function AgentTryDemoSection({
  agentId,
  agentName,
  templateSlug,
  onTestPassed,
}: AgentTryDemoSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="asp-card asp-demo" aria-labelledby="asp-demo-heading">
        <div className="asp-demo-badge" role="note">
          Simulation — no real action will be executed
        </div>
        <h2 id="asp-demo-heading" className="asp-card-title">
          Try this agent’s sandbox
        </h2>
        <p className="asp-card-subtitle">
          Run a template-specific simulation. Approvals stay in this panel until you close it.
        </p>
        <button type="button" className="asp-demo-btn" onClick={() => setOpen(true)}>
          <FlaskConical className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Open simulation
        </button>
      </section>

      <TemplateSimulationModal
        open={open}
        agentId={agentId}
        agentName={agentName}
        templateSlug={templateSlug}
        onClose={() => setOpen(false)}
        onCompleted={() => onTestPassed?.()}
      />
    </>
  );
}
