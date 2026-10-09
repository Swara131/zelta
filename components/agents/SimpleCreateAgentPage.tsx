"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { AGENT_CREATED_TOAST_KEY } from "@/components/agent-builder/AgentBuilderModal";
import { saveCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { saveAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { saveAgentConfigFromCreate } from "@/lib/agents/load-agent-setup-config";
import { createStandaloneLifecyclePatch } from "@/lib/agents/agent-mode";
import type { AgentSpec } from "@/lib/agent-builder/types";
import { FLOW_ERRORS, FLOW_LOADING } from "@/lib/ux/flow-copy";

const MAX_CHARS = 500;
const MIN_CHARS = 15;

const PLACEHOLDER =
  "e.g., Issue refunds to customers when they request cancellations under ₹5,000";

export default function SimpleCreateAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [description, setDescription] = useState(
    () => searchParams.get("idea")?.trim() ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = description.trim();
  const canSubmit = trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS && !submitting;

  const hint = useMemo(() => {
    if (trimmed.length === 0 || trimmed.length >= MIN_CHARS) return null;
    return `Add ${MIN_CHARS - trimmed.length} more character${MIN_CHARS - trimmed.length === 1 ? "" : "s"}.`;
  }, [trimmed.length]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/agents/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        agentId?: string;
        apiKey?: string;
        keyPrefix?: string;
        name?: string;
        spec?: AgentSpec;
        tools?: string[];
        triggerType?: string;
        suggestedThreshold?: number;
        error?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error ??
            (response.status >= 500 ? FLOW_ERRORS.genericApi : FLOW_ERRORS.createAgent)
        );
      }

      if (!payload.agentId || !payload.apiKey || !payload.spec || !payload.name) {
        throw new Error(FLOW_ERRORS.createAgent);
      }

      saveCreatedAgentSession({
        agentId: payload.agentId,
        plainKey: payload.apiKey,
        keyPrefix: payload.keyPrefix ?? "",
        spec: payload.spec,
        createdAt: new Date().toISOString(),
      });

      saveAgentConfigFromCreate({
        agentId: payload.agentId,
        name: payload.name,
        description: trimmed,
        purpose: trimmed,
        triggerType: payload.triggerType ?? "webhook",
        tools: payload.tools ?? payload.spec.tools.map((tool) => tool.toolName),
        suggestedThreshold: payload.suggestedThreshold ?? 5_000,
      });

      saveAgentLifecycle(payload.agentId, {
        ...createStandaloneLifecyclePatch(),
        actionsConfigured: true,
      });

      sessionStorage.setItem(AGENT_CREATED_TOAST_KEY, "✓ Agent created successfully!");

      router.push(`/agents/${encodeURIComponent(payload.agentId)}/workflow`);
    } catch (err) {
      const message =
        err instanceof Error && err.message !== FLOW_ERRORS.genericApi
          ? err.message
          : err instanceof Error
            ? err.message
            : FLOW_ERRORS.createAgent;
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <PageShell maxWidth="4xl" className="sca-page">
      <div className="sca-wrap">
        <div className="sca-inner">
          <h1 className="sca-title">✨ Create your first agent</h1>
          <p className="sca-subtitle">What should your agent do?</p>

          <label className="sca-field" htmlFor="sca-description">
            <span className="sr-only">Agent description</span>
            <textarea
              id="sca-description"
              className="sca-textarea ds-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={PLACEHOLDER}
              disabled={submitting}
              maxLength={MAX_CHARS}
              aria-describedby={hint ? "sca-hint" : undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </label>

          {hint ? (
            <p id="sca-hint" className="sca-hint">
              {hint}
            </p>
          ) : null}

          {error ? (
            <p className="sca-error" role="alert">
              {error}
            </p>
          ) : null}

          {submitting ? (
            <p className="sca-loading" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {FLOW_LOADING.creatingAgent}
            </p>
          ) : (
            <button
              type="button"
              className="sca-send-btn"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              Create
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
