"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { AgentCreatedToast } from "@/components/agent-builder/AgentBuilderModal";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

function buildExamplePayload(toolName: string): string {
  if (toolName === "send_email") {
    return "{ customerId: 'cus_123', subject: 'Refund confirmed' }";
  }
  if (toolName === "issue_refund") {
    return "{ customerId: 'cus_123', amount: 50000, currency: 'INR' }";
  }
  if (toolName === "send_whatsapp_message") {
    return "{ customerId: 'cus_123', message: 'Your request was received' }";
  }
  return "{ customerId: 'cus_123' }";
}

function buildProposeCode(params: {
  baseUrl: string;
  apiKey: string;
  agentId: string;
  toolName: string;
}): string {
  const payload = buildExamplePayload(params.toolName);

  return `const response = await fetch('${params.baseUrl}/api/v1/actions/propose', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${params.apiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agentId: '${params.agentId}',
    toolName: '${params.toolName}',
    payload: ${payload}
  })
});`;
}

const NEXT_STEPS = [
  {
    emoji: "⚙️",
    title: "Your agent proposes an action",
    description: "When your code calls the API",
  },
  {
    emoji: "🧠",
    title: "Wave checks if it's safe",
    description: "Scores risk and checks policy",
  },
  {
    emoji: "✓",
    title: "You approve or reject",
    description: "Action runs only after approval",
  },
] as const;

export default function AgentReadyPage() {
  const params = useParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const session = useMemo(
    () => (agentId ? loadCreatedAgentSession(agentId) : null),
    [agentId]
  );

  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const agentName =
    session?.spec?.name ?? humanizeAgentLabel(agentId, null);
  const apiKey = session?.plainKey ?? "al_xxxxx";
  const toolName = session?.spec?.tools[0]?.toolName ?? "send_email";

  const code = useMemo(
    () =>
      agentId
        ? buildProposeCode({ baseUrl, apiKey, agentId, toolName })
        : "",
    [agentId, apiKey, baseUrl, toolName]
  );

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!agentId) {
    return (
      <PageShell maxWidth="6xl">
        <p>Agent not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="6xl" className="arr-page">
      <AgentCreatedToast />

      <div className="arr-layout fade-in-up">
        <section className="arr-banner asp-card asp-complete-card" aria-labelledby="arr-banner-heading">
          <div className="asp-complete-glow" aria-hidden="true" />
          <h1 id="arr-banner-heading" className="asp-complete-title">
            🎉 Your agent is ready!
          </h1>
          <p className="asp-complete-lead">
            <CheckCircle2 className="asp-complete-check" strokeWidth={2} aria-hidden="true" />
            {agentName} is now protecting your actions
          </p>
          {session?.templateName ? (
            <p className="arr-template-source">
              Created from: {session.templateName} template
            </p>
          ) : null}

          <ul className="arr-status-list" aria-label="Setup status">
            <li className="arr-status-item">
              <Check className="arr-status-icon" strokeWidth={2.5} aria-hidden="true" />
              Agent created
            </li>
            <li className="arr-status-item">
              <Check className="arr-status-icon" strokeWidth={2.5} aria-hidden="true" />
              Protection enabled
            </li>
            <li className="arr-status-item">
              <Check className="arr-status-icon" strokeWidth={2.5} aria-hidden="true" />
              Ready to use
            </li>
          </ul>
        </section>

        <div className="arr-grid">
          <section className="arr-panel asp-card" aria-labelledby="arr-start-heading">
            <h2 id="arr-start-heading" className="arr-panel-title">
              Start using your agent
            </h2>
            <p className="arr-panel-desc">Copy this code into your app:</p>

            <div className="arr-code-wrap">
              <pre className="arr-code">
                <code>{code}</code>
              </pre>
              <button
                type="button"
                className="arr-copy-btn"
                onClick={() => void handleCopyCode()}
              >
                <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>

            <p className="arr-code-note">
              This code sends actions to Wave for approval before they run.
            </p>
          </section>

          <section className="arr-panel asp-card" aria-labelledby="arr-next-heading">
            <h2 id="arr-next-heading" className="arr-panel-title">
              What happens next
            </h2>

            <ul className="arr-next-list">
              {NEXT_STEPS.map((step) => (
                <li key={step.title} className="arr-next-card">
                  <span className="arr-next-icon" aria-hidden="true">
                    {step.emoji}
                  </span>
                  <div>
                    <p className="arr-next-title">{step.title}</p>
                    <p className="arr-next-desc">{step.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="arr-footer">
          <Link href="/integrations" className="arr-btn arr-btn-secondary">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Back to agents
          </Link>
          <Link href={`/agents/${encodeURIComponent(agentId)}/test`} className="arr-btn arr-btn-primary">
            Test my agent
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </PageShell>
  );
}
