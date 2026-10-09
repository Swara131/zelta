"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { saveAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { buildProposeExamples } from "@/lib/gateway/integration-examples";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

interface ConnectAgentStepModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  apiKey: AgentApiKeyRecord | null;
  onClose: () => void;
  onSaved: () => void;
  onNext?: () => void;
}

function CopyField({
  text,
  label,
  scrollable = false,
}: {
  text: string;
  label: string;
  scrollable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="cam-section">
      <div className="cam-section-head">
        <span className="cam-section-label">{label}</span>
        <button type="button" className="cam-copy-btn" onClick={() => void handleCopy()}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className={`cam-code ${scrollable ? "cam-code-scroll" : ""}`}>{text}</pre>
    </section>
  );
}

export default function ConnectAgentStepModal({
  open,
  agentId,
  apiKey,
  onClose,
  onSaved,
  onNext,
}: ConnectAgentStepModalProps) {
  const session = useMemo(
    () => (open ? loadCreatedAgentSession(agentId) : null),
    [open, agentId]
  );

  const displayKey =
    session?.plainKey ?? `${apiKey?.keyPrefix ?? "zelta"}… (full key shown once at creation)`;

  const agentIdLine = apiKey?.keyPrefix
    ? `${agentId} · Prefix ${apiKey.keyPrefix}…`
    : agentId;

  const curlExample = useMemo(() => {
    if (typeof window === "undefined") return "";
    const examples = buildProposeExamples({
      baseUrl: window.location.origin,
      agentId,
      apiKeyPlaceholder: session?.plainKey ?? "YOUR_AGENT_API_KEY",
    });
    return examples.curl;
  }, [agentId, session?.plainKey]);

  const acknowledgeConnection = () => {
    saveAgentLifecycle(agentId, { connectionAcknowledged: true });
    onSaved();
  };

  const handleBack = () => {
    onClose();
  };

  const handleNext = () => {
    acknowledgeConnection();
    onClose();
    onNext?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect your agent"
      variant="center"
      size="lg"
      panelClassName="cam-modal-panel"
      bodyClassName="cam-modal-body"
    >
      <div className="cam-modal">
        <p className="cam-subtitle">
          Add this API key to your code so every action routes through Wave
        </p>

        <div className="cam-scroll">
          <CopyField text={displayKey} label="API key" />

          <section className="cam-section cam-section-id">
            <span className="cam-section-label">Agent ID</span>
            <p className="cam-id-value">
              <code>{agentIdLine}</code>
            </p>
          </section>

          {!session?.plainKey ? (
            <p className="cam-warn" role="note">
              The full API key is only shown once when the agent is created. Use the key you
              saved, or create a new key from the agent setup page.
            </p>
          ) : null}

          <CopyField
            text={curlExample}
            label="Example — propose an action (curl)"
            scrollable
          />
        </div>

        <footer className="cam-footer">
          <button type="button" className="cam-btn cam-btn-back" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Back
          </button>
          <button type="button" className="cam-btn cam-btn-next" onClick={handleNext}>
            Next: Run Test Action
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </Modal>
  );
}
