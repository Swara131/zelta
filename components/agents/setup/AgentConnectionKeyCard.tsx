"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CreatedAgentSession } from "@/lib/agent-builder/created-agent-session";

interface AgentConnectionKeyCardProps {
  session: CreatedAgentSession;
}

export default function AgentConnectionKeyCard({ session }: AgentConnectionKeyCardProps) {
  const [copied, setCopied] = useState(false);

  const envExport = `export ZELTA_API_KEY=${session.plainKey}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(session.plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="asp-card asp-key-card" aria-labelledby="asp-key-heading">
      <h2 id="asp-key-heading" className="asp-card-title">
        Your API Key
      </h2>
      <p className="asp-key-warn">⚠️ This key is shown only once. Save it now.</p>

      <div className="asp-key-block">
        <code className="asp-key-value">{session.plainKey}</code>
        <button type="button" className="asp-key-copy" onClick={() => void handleCopy()}>
          {copied ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Copy key
            </>
          )}
        </button>
      </div>

      <p className="asp-key-meta">
        Agent ID: <code>{session.agentId}</code> · Prefix{" "}
        <code>{session.keyPrefix}…</code>
      </p>

      <div className="asp-key-env">
        <p className="asp-key-env-label">Add this to your environment:</p>
        <pre className="asp-key-env-code">{envExport}</pre>
      </div>
    </section>
  );
}
