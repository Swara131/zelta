"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import { MissingRequirementsBanner } from "@/components/agents/setup/AgentRequirementsList";
import {
  decisionInputLabel,
  defaultInputValue,
  parseInputValue,
} from "@/lib/decision-agents/input-labels";
import { getAgentRequirements } from "@/lib/agents/requirements/engine";
import { snapshotFromDecisionAgent } from "@/lib/agents/requirements/from-decision";
import type { DecisionAgentRecord } from "@/lib/decision-agents/types";
import AgentResultRenderer from "@/components/agents/results/AgentResultRenderer";

export default function DecisionAgentTestPage() {
  const params = useParams();
  const slug = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const [agent, setAgent] = useState<DecisionAgentRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    decision: string;
    reason: string;
    risk: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const response = await fetch(`/api/v1/decision-agents/${encodeURIComponent(slug)}`);
    const payload = (await response.json()) as { agent?: DecisionAgentRecord };
    const loaded = payload.agent ?? null;
    setAgent(loaded);
    if (loaded) {
      const initial: Record<string, string> = {};
      for (const key of loaded.config.inputs) {
        initial[key] = defaultInputValue(key);
      }
      setValues(initial);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTest = async () => {
    if (!slug) return;
    setRunning(true);
    setError(null);
    setResult(null);

    const input: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(values)) {
      input[key] = parseInputValue(key, raw);
    }

    try {
      const response = await fetch(
        `/api/v1/decision-agents/${encodeURIComponent(slug)}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        }
      );
      const payload = (await response.json()) as {
        decision?: string;
        actual?: string;
        reason?: string;
        risk?: string;
        result?: { reasoning: string; riskLevel: string };
        error?: string;
        missing?: Array<{ label: string; reason: string; key: string }>;
      };
      if (!response.ok) {
        const missing = payload.missing?.map((item) => item.label).join(", ");
        throw new Error(payload.error ?? (missing ? `Missing: ${missing}` : "Test failed."));
      }

      setResult({
        decision: payload.decision ?? payload.actual ?? "UNKNOWN",
        reason: payload.reason ?? payload.result?.reasoning ?? "",
        risk: payload.risk ?? payload.result?.riskLevel ?? "medium",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="4xl" className="zdec-page">
        <p className="zplat-loading"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</p>
      </PageShell>
    );
  }

  if (!agent) {
    return (
      <PageShell maxWidth="4xl" className="zdec-page">
        <p>Decision agent not found.</p>
      </PageShell>
    );
  }

  const missing = getAgentRequirements(snapshotFromDecisionAgent(agent, { stage: "test" })).missing;

  return (
    <PageShell maxWidth="4xl" className="zdec-page">
      <Link href={`/decision-agents/${encodeURIComponent(slug)}`} className="zplat-btn zplat-btn-ghost">
        ← Back
      </Link>
      <h1>Test Agent — {agent.name}</h1>
      {missing.length > 0 ? <MissingRequirementsBanner missing={missing} /> : null}
      <section className="ds-panel zdec-test-form">
        {agent.config.inputs.map((key) => (
          <label key={key} className="zplat-field">
            <span>{decisionInputLabel(key)}</span>
            {key === "customer_eligible" ? (
              <select
                className="ds-input"
                value={values[key] ?? "true"}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                className="ds-input"
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <button
          type="button"
          className="zplat-btn zplat-btn-primary"
          disabled={running || missing.length > 0}
          onClick={() => void runTest()}
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Running…
            </>
          ) : (
            "Run decision"
          )}
        </button>
      </section>
      {result ? (
        <AgentResultRenderer
          result={{
            action: agent.name,
            decision: result.decision,
            risk: result.risk,
            reason: result.reason,
          }}
          status="completed"
          onRetry={() => void runTest()}
        />
      ) : null}
      {error ? <p className="zplat-error" role="alert">{error}</p> : null}
    </PageShell>
  );
}
