"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SUPPORTED_CONNECTION_METHODS } from "@/lib/agents/external/connection-methods";
import type { ExternalConnectionMethod, ExternalTestCheck } from "@/lib/agents/external/types";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

type TestMode = "choose" | "zelta" | "external";

interface TestAgentPanelProps {
  onClose: () => void;
}

async function fetchKeys(): Promise<AgentApiKeyRecord[]> {
  const res = await fetch("/api/gateway/keys");
  if (!res.ok) return [];
  const payload = (await res.json()) as { keys?: AgentApiKeyRecord[] };
  return (payload.keys ?? []).filter((key) => !key.revokedAt);
}

function CheckRow({ check }: { check: ExternalTestCheck }) {
  const icon =
    check.status === "pass"
      ? "✓"
      : check.status === "fail"
        ? "✗"
        : check.status === "skipped"
          ? "—"
          : "○";
  return (
    <li className={`zplat-ext-check zplat-ext-check-${check.status}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{check.label}</span>
      {check.message ? <small>{check.message}</small> : null}
    </li>
  );
}

export default function TestAgentPanel({ onClose }: TestAgentPanelProps) {
  const [mode, setMode] = useState<TestMode>("choose");
  const [agents, setAgents] = useState<AgentApiKeyRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [method, setMethod] = useState<ExternalConnectionMethod>("rest_api");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "api_key_header">("none");
  const [authToken, setAuthToken] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("X-API-Key");
  const [sdkAgentId, setSdkAgentId] = useState("");
  const [sdkApiKey, setSdkApiKey] = useState("");
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<ExternalTestCheck[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchKeys().then(setAgents);
  }, []);

  const runExternalTest = useCallback(async () => {
    setRunning(true);
    setError(null);
    setChecks([]);
    setSummary(null);
    setPassed(null);

    try {
      const response = await fetch("/api/v1/agents/external/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          endpointUrl: method === "sdk" ? undefined : endpointUrl,
          authType,
          authToken: authToken || undefined,
          authHeaderName: authType === "api_key_header" ? authHeaderName : undefined,
          agentId: method === "sdk" ? sdkAgentId : undefined,
          apiKey: method === "sdk" ? sdkApiKey : undefined,
        }),
      });

      const payload = (await response.json()) as {
        result?: {
          passed: boolean;
          needsAttention: boolean;
          checks: ExternalTestCheck[];
          summary: string;
          safetyMessage?: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Test failed.");
      }

      setChecks(payload.result.checks);
      setSummary(payload.result.summary);
      setPassed(payload.result.passed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setRunning(false);
    }
  }, [authHeaderName, authToken, authType, endpointUrl, method, sdkAgentId, sdkApiKey]);

  return (
    <section className="zplat-subpanel ds-panel" aria-labelledby="zplat-test-agent-heading">
      <div className="zplat-subpanel-header">
        <div>
          <h2 id="zplat-test-agent-heading">Test an Agent</h2>
          <p className="zplat-subpanel-lead">
            Test an agent built with Wave or another platform.
          </p>
        </div>
        <button type="button" className="zplat-btn zplat-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {mode === "choose" ? (
        <div className="zplat-subpanel-choices">
          <p className="zplat-subpanel-question">How do you want to test your agent?</p>
          <button type="button" className="zplat-subpanel-choice" onClick={() => setMode("zelta")}>
            Select Existing Wave Agent
          </button>
          <button type="button" className="zplat-subpanel-choice" onClick={() => setMode("external")}>
            Connect External Agent
          </button>
        </div>
      ) : null}

      {mode === "zelta" ? (
        <div className="zplat-subpanel-body">
          <button type="button" className="zplat-link-back" onClick={() => setMode("choose")}>
            ← Back
          </button>
          <label className="zplat-field">
            <span>Wave agent</span>
            <select
              className="ds-input"
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
            >
              <option value="">Select an agent…</option>
              {agents.map((key) => (
                <option key={key.id} value={key.agentId}>
                  {key.name || key.agentId}
                </option>
              ))}
            </select>
          </label>
          {selectedAgentId ? (
            <Link
              href={`/agents/${encodeURIComponent(selectedAgentId)}/test`}
              className="zplat-btn zplat-btn-primary"
            >
              Open full test workspace
            </Link>
          ) : null}
          <p className="zplat-subpanel-note">
            Wave agents use the full test suite — configuration, workflow, execution, and safety.
          </p>
        </div>
      ) : null}

      {mode === "external" ? (
        <div className="zplat-subpanel-body">
          <button type="button" className="zplat-link-back" onClick={() => setMode("choose")}>
            ← Back
          </button>

          <fieldset className="zplat-method-fieldset">
            <legend>Connection method</legend>
            <div className="zplat-method-grid">
              {SUPPORTED_CONNECTION_METHODS.map((option) => (
                <label key={option.id} className="zplat-method-option">
                  <input
                    type="radio"
                    name="test-method"
                    checked={method === option.id}
                    onChange={() => setMethod(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="zplat-subpanel-note">MCP is not supported yet.</p>
          </fieldset>

          {method === "sdk" ? (
            <>
              <label className="zplat-field">
                <span>Agent ID</span>
                <input
                  className="ds-input"
                  value={sdkAgentId}
                  onChange={(event) => setSdkAgentId(event.target.value)}
                  placeholder="your-agent-id"
                />
              </label>
              <label className="zplat-field">
                <span>Wave API key</span>
                <input
                  className="ds-input"
                  type="password"
                  value={sdkApiKey}
                  onChange={(event) => setSdkApiKey(event.target.value)}
                  placeholder="Paste API key to verify gateway auth"
                />
              </label>
            </>
          ) : (
            <>
              <label className="zplat-field">
                <span>Agent endpoint</span>
                <input
                  className="ds-input"
                  value={endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                  placeholder="https://your-agent.example.com/run"
                />
              </label>
              <label className="zplat-field">
                <span>Authentication</span>
                <select
                  className="ds-input"
                  value={authType}
                  onChange={(event) =>
                    setAuthType(event.target.value as "none" | "bearer" | "api_key_header")
                  }
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="api_key_header">API key header</option>
                </select>
              </label>
              {authType === "api_key_header" ? (
                <label className="zplat-field">
                  <span>Header name</span>
                  <input
                    className="ds-input"
                    value={authHeaderName}
                    onChange={(event) => setAuthHeaderName(event.target.value)}
                  />
                </label>
              ) : null}
              {authType !== "none" ? (
                <label className="zplat-field">
                  <span>Credential</span>
                  <input
                    className="ds-input"
                    type="password"
                    value={authToken}
                    onChange={(event) => setAuthToken(event.target.value)}
                  />
                </label>
              ) : null}
            </>
          )}

          <button
            type="button"
            className="zplat-btn zplat-btn-primary"
            disabled={running}
            onClick={() => void runExternalTest()}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Testing agent…
              </>
            ) : (
              "Connect & Test"
            )}
          </button>

          {checks.length > 0 ? (
            <ul className="zplat-ext-checklist">
              {checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          ) : null}

          {passed !== null ? (
            <p className={passed ? "zplat-result-pass" : "zplat-result-warn"}>
              {passed ? "✓ Test passed" : "⚠ Test needs attention"}
              {summary ? ` — ${summary}` : ""}
            </p>
          ) : null}

          {error ? <p className="zplat-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
