"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  decisionInputLabel,
  defaultInputValue,
  parseInputValue,
} from "@/lib/decision-agents/input-labels";
import AgentResultRenderer from "@/components/agents/results/AgentResultRenderer";
import type { DecisionAgentConfig } from "@/lib/decision-agents/types";

interface DecisionAgentInlineTestProps {
  config: DecisionAgentConfig;
  slug?: string | null;
  onClose: () => void;
}

export default function DecisionAgentInlineTest({
  config,
  slug,
  onClose,
}: DecisionAgentInlineTestProps) {
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const key of config.inputs) {
      values[key] = defaultInputValue(key);
    }
    return values;
  }, [config.inputs]);

  const [values, setValues] = useState(initialValues);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    decision: string;
    reason: string;
    risk: string;
  } | null>(null);

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);

    const input: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(values)) {
      input[key] = parseInputValue(key, raw);
    }

    try {
      const url = slug
        ? `/api/v1/decision-agents/${encodeURIComponent(slug)}/test`
        : "/api/v1/decision-agents/evaluate";

      const body = slug ? { input } : { config, input };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        decision?: string;
        actual?: string;
        reason?: string;
        risk?: string;
        result?: { reasoning: string; riskLevel: string; outcome: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Test failed.");
      }

      setResult({
        decision: payload.decision ?? payload.actual ?? payload.result?.outcome.toUpperCase() ?? "UNKNOWN",
        reason: payload.reason ?? payload.result?.reasoning ?? "",
        risk: payload.risk ?? payload.result?.riskLevel ?? "medium",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="zdec-inline-test ds-panel">
      <div className="zdec-inline-test-header">
        <h3>Test Agent</h3>
        <button type="button" className="zplat-btn zplat-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {config.inputs.map((key) => (
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
        disabled={running}
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

      {result ? (
        <AgentResultRenderer
          result={{
            decision: result.decision,
            risk: result.risk,
            reason: result.reason,
          }}
          status="completed"
          variant="compact"
          onRetry={() => void runTest()}
        />
      ) : null}

      {error ? <p className="zplat-error" role="alert">{error}</p> : null}
    </section>
  );
}
