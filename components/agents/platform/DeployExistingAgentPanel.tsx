"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  DEPLOY_PLATFORM_OPTIONS,
  platformDisplayName,
  type AgentConnectionPlatformId,
} from "@/lib/agents/platform/connection-options";
import { SUPPORTED_CONNECTION_METHODS } from "@/lib/agents/external/connection-methods";
import type { ExternalConnectionMethod, ExternalTestCheck } from "@/lib/agents/external/types";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";

interface DeployExistingAgentPanelProps {
  onClose: () => void;
}

type Step = "platform" | "connect" | "summary";

async function fetchKeys(): Promise<AgentApiKeyRecord[]> {
  const res = await fetch("/api/gateway/keys");
  if (!res.ok) return [];
  const payload = (await res.json()) as { keys?: AgentApiKeyRecord[] };
  return (payload.keys ?? []).filter((key) => !key.revokedAt);
}

export default function DeployExistingAgentPanel({ onClose }: DeployExistingAgentPanelProps) {
  const [step, setStep] = useState<Step>("platform");
  const [platform, setPlatform] = useState<AgentConnectionPlatformId | null>(null);
  const [agents, setAgents] = useState<AgentApiKeyRecord[]>([]);
  const [selectedZeltaAgent, setSelectedZeltaAgent] = useState("");
  const [agentName, setAgentName] = useState("");
  const [method, setMethod] = useState<ExternalConnectionMethod>("sdk");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "api_key_header">("bearer");
  const [authToken, setAuthToken] = useState("");
  const [authHeaderName] = useState("X-API-Key");
  const [sdkAgentId, setSdkAgentId] = useState("");
  const [sdkApiKey, setSdkApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [registeredSlug, setRegisteredSlug] = useState<string | null>(null);
  const [checks, setChecks] = useState<ExternalTestCheck[]>([]);
  const [safetyMessage, setSafetyMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ id: string; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [deployedAt, setDeployedAt] = useState<string | null>(null);

  useEffect(() => {
    void fetchKeys().then(setAgents);
  }, []);

  const selectPlatform = (id: AgentConnectionPlatformId) => {
    setPlatform(id);
    setStep(id === "zelta" ? "connect" : "connect");
    if (id === "n8n") setMethod("webhook");
    else if (id === "langchain" || id === "copilot") setMethod("rest_api");
    else if (id !== "zelta") setMethod("sdk");
  };

  const runConnectionTest = useCallback(async () => {
    if (!platform) return;
    setTesting(true);
    setError(null);
    setIssues([]);
    setConnected(false);

    try {
      if (platform === "zelta") {
        if (!selectedZeltaAgent) throw new Error("Select a Wave agent.");
        setRegisteredSlug(selectedZeltaAgent);
        setConnected(true);
        setChecks([
          { id: "connection", label: "Connection", status: "pass", message: "Wave agent selected." },
        ]);
        setStep("summary");
        return;
      }

      const name = agentName.trim() || sdkAgentId.trim() || "External agent";
      const response = await fetch("/api/v1/agents/external/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: name,
          agentSlug: sdkAgentId.trim() || undefined,
          platform,
          method,
          endpointUrl: method === "sdk" ? undefined : endpointUrl,
          authType,
          authToken: authToken || undefined,
          authHeaderName: authType === "api_key_header" ? authHeaderName : undefined,
          agentId: method === "sdk" ? sdkAgentId : undefined,
          apiKey: method === "sdk" ? sdkApiKey : undefined,
          saveOnlyIfPassed: true,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        slug?: string;
        result?: {
          passed: boolean;
          checks: ExternalTestCheck[];
          safetyMessage?: string;
        };
        error?: string;
        issues?: Array<{ id: string; message: string }>;
      };

      if (payload.result) {
        setChecks(payload.result.checks);
        setSafetyMessage(payload.result.safetyMessage ?? null);
      }

      if (!payload.success || !payload.result?.passed) {
        throw new Error(payload.error ?? "Connection test failed.");
      }

      setRegisteredSlug(payload.slug ?? null);
      setConnected(true);
      setStep("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }, [
    agentName,
    authHeaderName,
    authToken,
    authType,
    endpointUrl,
    method,
    platform,
    sdkAgentId,
    sdkApiKey,
    selectedZeltaAgent,
  ]);

  const runDeploy = useCallback(async () => {
    if (!registeredSlug) return;
    setDeploying(true);
    setError(null);
    setIssues([]);

    try {
      if (platform === "zelta") {
        window.location.href = `/agents/${encodeURIComponent(registeredSlug)}/deploy`;
        return;
      }

      const response = await fetch("/api/v1/agents/external/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: registeredSlug, environment: "production" }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        ready?: boolean;
        issues?: Array<{ id: string; message: string }>;
        deployedAt?: string;
        message?: string;
        error?: string;
      };

      if (!payload.success || !payload.ready) {
        setIssues(payload.issues ?? [{ id: "deploy", message: payload.message ?? "Not ready." }]);
        return;
      }

      setDeployedAt(payload.deployedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed.");
    } finally {
      setDeploying(false);
    }
  }, [platform, registeredSlug]);

  return (
    <section className="zplat-subpanel ds-panel" aria-labelledby="zplat-deploy-existing-heading">
      <div className="zplat-subpanel-header">
        <div>
          <h2 id="zplat-deploy-existing-heading">Deploy an Existing Agent</h2>
          <p className="zplat-subpanel-lead">
            Bring an agent you&apos;ve already built and deploy or operate it through Wave.
          </p>
        </div>
        <button type="button" className="zplat-btn zplat-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {step === "platform" ? (
        <>
          <p className="zplat-subpanel-question">Where was your agent built?</p>
          <ul className="zplat-platform-compact">
            {DEPLOY_PLATFORM_OPTIONS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="zplat-platform-compact-btn"
                  onClick={() => selectPlatform(option.id)}
                >
                  {option.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {step === "connect" && platform ? (
        <div className="zplat-subpanel-body">
          <button type="button" className="zplat-link-back" onClick={() => setStep("platform")}>
            ← Back
          </button>
          <p className="zplat-subpanel-kicker">{platformDisplayName(platform)}</p>

          {platform === "zelta" ? (
            <label className="zplat-field">
              <span>Select Wave agent</span>
              <select
                className="ds-input"
                value={selectedZeltaAgent}
                onChange={(event) => setSelectedZeltaAgent(event.target.value)}
              >
                <option value="">Choose…</option>
                {agents.map((key) => (
                  <option key={key.id} value={key.agentId}>
                    {key.name || key.agentId}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="zplat-field">
                <span>Agent name</span>
                <input
                  className="ds-input"
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="Customer Support Agent"
                />
              </label>
              <label className="zplat-field">
                <span>Connection</span>
                <select
                  className="ds-input"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as ExternalConnectionMethod)}
                >
                  {SUPPORTED_CONNECTION_METHODS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {method === "sdk" ? (
                <>
                  <label className="zplat-field">
                    <span>Agent ID</span>
                    <input
                      className="ds-input"
                      value={sdkAgentId}
                      onChange={(event) => setSdkAgentId(event.target.value)}
                    />
                  </label>
                  <label className="zplat-field">
                    <span>API key</span>
                    <input
                      className="ds-input"
                      type="password"
                      value={sdkApiKey}
                      onChange={(event) => setSdkApiKey(event.target.value)}
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
                      <option value="bearer">Bearer</option>
                      <option value="api_key_header">API key header</option>
                    </select>
                  </label>
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
            </>
          )}

          <button
            type="button"
            className="zplat-btn zplat-btn-secondary"
            disabled={testing}
            onClick={() => void runConnectionTest()}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Testing…
              </>
            ) : (
              "Test Connection"
            )}
          </button>
          {error ? <p className="zplat-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === "summary" && connected ? (
        <div className="zplat-subpanel-body">
          <p className="zplat-result-pass">✓ Agent connected</p>
          <dl className="zplat-deploy-summary">
            <div>
              <dt>Agent</dt>
              <dd>{agentName || selectedZeltaAgent || registeredSlug}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{platform ? platformDisplayName(platform) : "—"}</dd>
            </div>
            <div>
              <dt>Connection</dt>
              <dd>✓ Verified</dd>
            </div>
            <div>
              <dt>Safety</dt>
              <dd>
                {platform === "zelta" ? (
                  <Link href="/safety" className="zplat-fix-link">
                    Configure
                  </Link>
                ) : safetyMessage ? (
                  safetyMessage
                ) : (
                  "Evaluate before deploy"
                )}
              </dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Production</dd>
            </div>
          </dl>

          {issues.length > 0 ? (
            <div className="zplat-deploy-blocked" role="alert">
              <p>Agent isn&apos;t ready for deployment.</p>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.id}>❌ {issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {deployedAt ? (
            <p className="zplat-result-pass">
              Deployed at {new Date(deployedAt).toLocaleString()}
            </p>
          ) : (
            <button
              type="button"
              className="zplat-btn zplat-btn-primary"
              disabled={deploying}
              onClick={() => void runDeploy()}
            >
              {deploying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deploying…
                </>
              ) : (
                "Deploy"
              )}
            </button>
          )}

          {registeredSlug && platform !== "zelta" ? (
            <Link
              href={`/agents/${encodeURIComponent(registeredSlug)}`}
              className="zplat-btn zplat-btn-ghost"
            >
              Open agent
            </Link>
          ) : null}
        </div>
      ) : null}

      {checks.length > 0 && step !== "summary" ? (
        <ul className="zplat-ext-checklist">
          {checks.map((check) => (
            <li key={check.id} className={`zplat-ext-check zplat-ext-check-${check.status}`}>
              {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "○"} {check.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
