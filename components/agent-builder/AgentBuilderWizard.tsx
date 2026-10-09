"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import Button from "@/components/ui/Button";
import type { AgentSpec } from "@/lib/agent-builder/types";
import { saveCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import {
  AGENT_CAPABILITY_OPTIONS,
  AGENT_TYPE_OPTIONS,
  buildWizardDescription,
  type AgentCapabilityId,
  type AgentTypeId,
} from "@/lib/agent-builder/wizard-options";
import { saveAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";

const EXAMPLE_PURPOSE =
  "Processes customer refunds and billing adjustments under ₹5,000 automatically.";

export default function AgentBuilderWizard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [agentType, setAgentType] = useState<AgentTypeId>("customer-support");
  const [capabilities, setCapabilities] = useState<AgentCapabilityId[]>([
    "read-customer",
    "send-email",
    "issue-refund",
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCapability = (id: AgentCapabilityId) => {
    setCapabilities((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);

    try {
      const description = buildWizardDescription({ name, purpose, agentType, capabilities });
      const genRes = await fetch("/api/agent-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const genPayload = (await genRes.json()) as { spec?: AgentSpec; error?: string };
      if (!genRes.ok) throw new Error(genPayload.error ?? "Failed to generate agent.");

      const spec = genPayload.spec;
      if (!spec) throw new Error("Agent spec was not returned.");

      const keyRes = await fetch("/api/gateway/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: spec.agentId, name: spec.name }),
      });
      const keyPayload = (await keyRes.json()) as {
        plainKey?: string;
        key?: { keyPrefix?: string; agentId?: string };
        error?: string;
      };
      if (!keyRes.ok) throw new Error(keyPayload.error ?? "Failed to create agent.");
      if (!keyPayload.plainKey || !keyPayload.key?.agentId) {
        throw new Error("Incomplete response from agent creation.");
      }

      saveCreatedAgentSession({
        spec,
        plainKey: keyPayload.plainKey,
        keyPrefix: keyPayload.key.keyPrefix ?? "",
        agentId: keyPayload.key.agentId,
        createdAt: new Date().toISOString(),
      });

      saveAgentLifecycle(keyPayload.key.agentId, { capabilities });

      router.push(`/agents/${encodeURIComponent(keyPayload.key.agentId)}/setup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent.");
    } finally {
      setCreating(false);
    }
  }, [name, purpose, agentType, capabilities, router]);

  const canCreate =
    name.trim().length >= 2 && purpose.trim().length >= 10 && capabilities.length > 0;

  return (
    <PageShell maxWidth="4xl" className="ab-page">
      <div className="ab-flow fade-in-up">
        <div className="ab-hero-icon" aria-hidden="true">
          <Bot className="h-8 w-8 text-white" strokeWidth={2} />
        </div>

        <h1 className="ab-title">Create AI Agent</h1>
        <p className="ab-lead">
          Define your agent below. After creation, you&apos;ll go straight into setup to
          configure actions, protection, connection, and testing.
        </p>

        <section className="ab-wizard-panel ds-panel">
          <label className="ab-field">
            <span className="ab-field-label">Agent name</span>
            <input
              className="ds-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer Refund Agent"
            />
          </label>

          <label className="ab-field">
            <span className="ab-field-label">Purpose</span>
            <textarea
              className="cp-textarea ab-textarea"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={EXAMPLE_PURPOSE}
            />
          </label>

          <fieldset className="ab-field">
            <legend className="ab-field-label">Agent type</legend>
            <div className="ab-type-grid">
              {AGENT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`ab-type-btn ${agentType === option.id ? "ab-type-btn-selected" : ""}`}
                  onClick={() => setAgentType(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="ab-field">
            <legend className="ab-field-label">Initial actions (configure fully in setup)</legend>
            <ul className="ab-capability-grid">
              {AGENT_CAPABILITY_OPTIONS.map((option) => {
                const selected = capabilities.includes(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={`ab-capability-btn ${selected ? "ab-capability-btn-selected" : ""}`}
                      onClick={() => toggleCapability(option.id)}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {error ? (
            <p className="ab-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ab-actions">
            <Button
              variant="primary"
              size="lg"
              icon={Sparkles}
              loading={creating}
              disabled={!canCreate || creating}
              onClick={() => void handleCreate()}
            >
              Create Agent →
            </Button>
          </div>

          <p className="ab-through-zelta">
            Next: configure actions, protection, connect, test, and activate — all in one setup
            wizard.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
