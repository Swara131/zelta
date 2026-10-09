"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import Button from "@/components/ui/Button";
import { AgentCreatedToast } from "@/components/agent-builder/AgentBuilderModal";
import PlainEnglishProtection from "@/components/protection/PlainEnglishProtection";
import SecurityPipeline from "@/components/ui/SecurityPipeline";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import {
  canActivateAgent,
  getActivationSummary,
  loadAgentLifecycle,
  loadSetupWizardStep,
  markAgentProtectionConfigured,
  saveAgentLifecycle,
  saveSetupWizardStep,
  SETUP_WIZARD_STEPS,
  setupStepCompletion,
  type SetupWizardStepId,
} from "@/lib/agent-builder/agent-onboarding";
import {
  AGENT_CAPABILITY_OPTIONS,
  AGENT_TYPE_OPTIONS,
  type AgentCapabilityId,
} from "@/lib/agent-builder/wizard-options";
import {
  loadAgentConfigCache,
  saveAgentConfigCache,
} from "@/lib/agents/agent-config-storage";
import {
  getAdvancedProtectionPolicies,
  protectionFromAgentSpec,
} from "@/lib/protection/plain-english";
import { saveProtectionRules, loadProtectionRules } from "@/lib/protection/protection-rules-store";
import { AGENT_QUICK_TEST_PRESETS } from "@/lib/agent-builder/agent-quick-tests";
import { DEMO_SAFETY_DISCLAIMER } from "@/lib/safety-check/demo-action-catalog";
import type { SafetyCheckResult } from "@/lib/safety-check/evaluate-safety-check";
import { buildProposeExamples } from "@/lib/gateway/integration-examples";

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Failed to load agents.");
  return payload.keys ?? [];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ds-btn ds-btn-ghost ds-btn-sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StepProgress({ step, lifecycle }: { step: SetupWizardStepId; lifecycle: ReturnType<typeof loadAgentLifecycle> }) {
  const completed = setupStepCompletion(lifecycle);
  return (
    <ol className="asw-progress" aria-label="Setup progress">
      {SETUP_WIZARD_STEPS.map((s, index) => {
        const done = completed[index];
        const current = step === s.id;
        return (
          <li
            key={s.key}
            className={`asw-progress-step ${done ? "asw-progress-step-done" : ""} ${current ? "asw-progress-step-current" : ""}`}
          >
            <span className="asw-progress-marker">{done ? "✓" : s.id}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

function decisionClass(decision: SafetyCheckResult["decision"]): string {
  switch (decision) {
    case "ALLOW":
      return "asw-result-allow";
    case "REVIEW":
      return "asw-result-review";
    case "BLOCK":
      return "asw-result-block";
  }
}

export default function AgentSetupWizard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const wizardParam = searchParams.get("wizard");
  const initialStepFromQuery = wizardParam ? Number.parseInt(wizardParam, 10) : null;

  const [step, setStep] = useState<SetupWizardStepId>(1);
  const [key, setKey] = useState<AgentApiKeyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState(loadAgentLifecycle(agentId));
  const [capabilities, setCapabilities] = useState<AgentCapabilityId[]>([]);
  const [keyCopied, setKeyCopied] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [testRunning, setTestRunning] = useState<string | null>(null);
  const [connectionTestResult, setConnectionTestResult] = useState<SafetyCheckResult | null>(null);
  const [actionTestResult, setActionTestResult] = useState<SafetyCheckResult | null>(null);
  const [lastActionLabel, setLastActionLabel] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const session = useMemo(
    () => (agentId ? loadCreatedAgentSession(agentId) : null),
    [agentId]
  );
  const spec = session?.spec ?? null;

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const apiExample = useMemo(() => {
    if (!agentId) return "";
    return buildProposeExamples({ baseUrl, agentId }).curl;
  }, [baseUrl, agentId]);

  const goToStep = useCallback(
    (next: SetupWizardStepId) => {
      setStep(next);
      if (agentId) saveSetupWizardStep(agentId, next);
    },
    [agentId, setStep]
  );

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    const stored = loadAgentLifecycle(agentId);
    setLifecycle(stored);
    setCapabilities(
      stored.capabilities.length > 0
        ? stored.capabilities
        : ["read-customer", "send-email", "issue-refund"]
    );
    const storedStep = loadSetupWizardStep(agentId);
    const resolvedStep =
      initialStepFromQuery && initialStepFromQuery >= 1 && initialStepFromQuery <= 6
        ? (initialStepFromQuery as SetupWizardStepId)
        : storedStep;
    setStep(resolvedStep);

    void fetchAgentKeys()
      .then((keys) => {
        const found = keys.find((k) => !k.revokedAt && k.agentId === agentId) ?? null;
        setKey(found);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load agent.");
      })
      .finally(() => setLoading(false));
  }, [agentId, initialStepFromQuery]);

  const refreshLifecycle = useCallback(() => {
    if (!agentId) return;
    setLifecycle(loadAgentLifecycle(agentId));
  }, [agentId]);

  const toggleCapability = (id: AgentCapabilityId) => {
    setCapabilities((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const runConnectionTest = async () => {
    if (!agentId || !spec) return;
    setConnectionTesting(true);
    setError(null);
    try {
      const response = await fetch("/api/safety-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName: spec.name,
          actionId: "send_email",
          customerId: "cus_connection_test",
          reason: "Connection test — verify Wave receives agent actions.",
        }),
      });
      const payload = (await response.json()) as {
        result?: SafetyCheckResult;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Connection test failed.");
      setConnectionTestResult(payload.result ?? null);
      saveAgentLifecycle(agentId, { connectionTestPassed: true });
      refreshLifecycle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setConnectionTesting(false);
    }
  };

  const runActionTest = async (presetId: string) => {
    const preset = AGENT_QUICK_TEST_PRESETS.find((p) => p.id === presetId);
    if (!preset || !spec) return;
    setTestRunning(presetId);
    setError(null);
    try {
      const response = await fetch("/api/safety-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName: spec.name,
          actionId: preset.actionId,
          customerId: "cus_demo_test",
          reason: preset.reason ?? "Setup wizard test action",
          amountInr: preset.amountInr ?? null,
        }),
      });
      const payload = (await response.json()) as {
        result?: SafetyCheckResult;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Test failed.");
      setActionTestResult(payload.result ?? null);
      setLastActionLabel(preset.label);
      saveAgentLifecycle(agentId, { testActionPassed: true });
      refreshLifecycle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setTestRunning(null);
    }
  };

  const handleActivate = () => {
    if (!agentId || !canActivateAgent(lifecycle, key)) return;
    setActivating(true);
    const next = saveAgentLifecycle(agentId, {
      activated: true,
      activatedAt: new Date().toISOString(),
    });
    setLifecycle(next);
    setActivating(false);
  };

  if (!agentId) {
    return (
      <PageShell maxWidth="4xl">
        <p className="asw-error">Invalid agent.</p>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell maxWidth="4xl">
        <div className="asw-loading">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading setup…
        </div>
      </PageShell>
    );
  }

  if (!key) {
    return (
      <PageShell maxWidth="4xl">
        <div className="asw-missing ds-panel">
          <h1 className="asw-title">Agent not found</h1>
          <p>Create an agent first, then return here to complete setup.</p>
          <Link href="/agents/build" className="ds-btn ds-btn-primary mt-4">
            Create Agent
          </Link>
        </div>
      </PageShell>
    );
  }

  const activation = getActivationSummary(lifecycle, key);
  const agentName = spec?.name ?? key.name ?? agentId;
  const typeLabel =
    AGENT_TYPE_OPTIONS.find((t) => t.id === "customer-support")?.label ?? "Custom";

  return (
    <PageShell maxWidth="4xl" className="asw-page">
      <div className="asw-flow fade-in-up">
        <Link
          href={`/agents/${encodeURIComponent(agentId)}/setup`}
          className="ag-back-link"
        >
          ← Back to agent
        </Link>
        <p className="asw-kicker">Agent setup</p>
        <h1 className="asw-title">{agentName}</h1>
        <p className="asw-lead">
          Complete each step to connect, protect, and activate your agent with Wave.
        </p>

        <StepProgress step={step} lifecycle={lifecycle} />

        {error ? (
          <p className="asw-error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 1 — Agent details</h2>
            <p className="asw-explain">
              Your agent has been created. Review its details before configuring actions and
              protection.
            </p>
            <dl className="asw-details">
              <div>
                <dt>Agent name</dt>
                <dd>{agentName}</dd>
              </div>
              <div>
                <dt>Purpose</dt>
                <dd>{spec?.summary || spec?.purpose || "—"}</dd>
              </div>
              <div>
                <dt>Agent type</dt>
                <dd>{typeLabel}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(key.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            <aside className="asw-example" role="note">
              <strong>Example:</strong> &ldquo;Customer Refund Agent processes customer refunds
              and billing adjustments under your protection rules.&rdquo;
            </aside>
            <div className="asw-nav">
              <Button variant="primary" icon={ArrowRight} onClick={() => goToStep(2)}>
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 2 — Configure actions</h2>
            <p className="asw-explain">
              Select what this agent is allowed to attempt. Wave will evaluate each action
              against your protection rules.
            </p>
            <ul className="asw-cap-grid">
              {AGENT_CAPABILITY_OPTIONS.map((option) => {
                const selected = capabilities.includes(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={`asw-cap-btn ${selected ? "asw-cap-btn-on" : ""}`}
                      onClick={() => toggleCapability(option.id)}
                    >
                      {selected ? <Check className="h-4 w-4" /> : null}
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <aside className="asw-example" role="note">
              <strong>Example:</strong> A support agent might read customer data, send emails,
              and issue refunds — but never delete records.
            </aside>
            <div className="asw-nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={capabilities.length === 0}
                onClick={() => {
                  saveAgentLifecycle(agentId, {
                    actionsConfigured: true,
                    capabilities,
                  });
                  const existing = loadAgentConfigCache(agentId);
                  saveAgentConfigCache({
                    agentId,
                    name: spec?.name ?? key?.name ?? agentId,
                    description: existing?.description ?? spec?.summary ?? spec?.purpose ?? "",
                    purpose: existing?.purpose ?? spec?.purpose ?? spec?.summary ?? "",
                    agentType: existing?.agentType ?? "Created with Wave",
                    triggerType: existing?.triggerType ?? "webhook",
                    tools: existing?.tools ?? spec?.tools.map((tool) => tool.toolName) ?? [],
                    capabilities,
                    suggestedThreshold: existing?.suggestedThreshold ?? null,
                    updatedAt: new Date().toISOString(),
                  });
                  refreshLifecycle();
                  goToStep(3);
                }}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 && spec ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 3 — Configure protection</h2>
            <p className="asw-explain">
              Define what happens automatically, what needs your approval, and what is never
              allowed.
            </p>
            <PlainEnglishProtection
              config={protectionFromAgentSpec(spec)}
              showExplanation={false}
              advancedPolicies={getAdvancedProtectionPolicies()}
            />
            <aside className="asw-example" role="note">
              <strong>Example:</strong> Refund up to ₹5,000 → allowed. Refund ₹25,000 → ask
              you first. Delete customer record → always blocked.
            </aside>
            <div className="asw-nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(2)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                onClick={() => {
                  saveProtectionRules(loadProtectionRules());
                  markAgentProtectionConfigured(agentId);
                  refreshLifecycle();
                  goToStep(4);
                }}
              >
                Save &amp; Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 4 — Connect agent</h2>
            <p className="asw-explain">
              Add your API key to your agent code. Send proposed actions to Wave before they
              execute.
            </p>
            {session?.plainKey ? (
              <>
                <p className="asw-meta">
                  Agent ID: <code>{agentId}</code> · Prefix{" "}
                  <code>{session.keyPrefix}…</code>
                </p>
                <pre className="asw-code">{session.plainKey}</pre>
                <CopyButton text={session.plainKey} />
              </>
            ) : (
              <p className="asw-explain">
                API key was already shown once. Create a new key from{" "}
                <Link href={`/integrations?agent=${encodeURIComponent(agentId)}&connect=1`} className="fd-link">
                  My Agents
                </Link>{" "}
                if you need another.
              </p>
            )}
            {apiExample ? (
              <>
                <p className="asw-meta mt-4">Example request</p>
                <pre className="asw-code">{apiExample}</pre>
                <CopyButton text={apiExample} />
              </>
            ) : null}
            <label className="asw-check">
              <input
                type="checkbox"
                checked={keyCopied}
                onChange={(e) => setKeyCopied(e.target.checked)}
              />
              I have copied my API key and added it to my agent
            </label>
            <aside className="asw-example" role="note">
              <strong>Example:</strong> Your agent POSTs to{" "}
              <code>/api/v1/actions/propose</code> before running a refund or email action.
            </aside>
            <div className="asw-nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(3)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={!keyCopied}
                onClick={() => {
                  saveAgentLifecycle(agentId, { connectionAcknowledged: true });
                  refreshLifecycle();
                  goToStep(5);
                }}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 5 && spec ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 5 — Test connection &amp; action</h2>
            <p className="asw-explain">
              Verify Wave receives and evaluates actions from your agent.
            </p>
            <p className="asw-demo">{DEMO_SAFETY_DISCLAIMER}</p>

            <div className="asw-test-block">
              <h3 className="asw-subtitle">Test connection</h3>
              <p className="asw-explain-sm">
                Sends a low-risk demo action through Wave to confirm the evaluation pipeline
                works.
              </p>
              <Button
                variant="secondary"
                loading={connectionTesting}
                onClick={() => void runConnectionTest()}
              >
                Test connection
              </Button>
              {connectionTestResult ? (
                <p className="asw-test-ok">
                  ✓ Connection test passed — Wave returned{" "}
                  {connectionTestResult.decision}
                </p>
              ) : null}
            </div>

            <div className="asw-test-block">
              <h3 className="asw-subtitle">Run test action</h3>
              <p className="asw-explain-sm">
                See how Wave decides Allow, Approval required, or Block.
              </p>
              <div className="asw-test-btns">
                {AGENT_QUICK_TEST_PRESETS.slice(0, 3).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="asw-test-btn"
                    disabled={testRunning !== null}
                    onClick={() => void runActionTest(preset.id)}
                  >
                    {testRunning === preset.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {preset.label}
                  </button>
                ))}
              </div>
              {actionTestResult && lastActionLabel ? (
                <article className={`asw-decision ${decisionClass(actionTestResult.decision)}`}>
                  <p className="asw-decision-action">{lastActionLabel}</p>
                  <dl className="asw-decision-grid">
                    <div>
                      <dt>Policy</dt>
                      <dd>{actionTestResult.policyDecision}</dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{actionTestResult.riskLevel}</dd>
                    </div>
                    <div>
                      <dt>Decision</dt>
                      <dd>
                        {actionTestResult.decision === "ALLOW" && "Allow"}
                        {actionTestResult.decision === "REVIEW" && "⚠ Approval required"}
                        {actionTestResult.decision === "BLOCK" && "Block"}
                      </dd>
                    </div>
                  </dl>
                  <p className="asw-explain-sm">
                    Wave evaluated this action before execution. No real system was changed.
                  </p>
                </article>
              ) : null}
            </div>

            <aside className="asw-example" role="note">
              <strong>Example:</strong> ₹2,000 refund → Allow. ₹25,000 refund → Approval
              required. Delete customer → Block.
            </aside>
            <div className="asw-nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(4)}>
                Back
              </Button>
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={!lifecycle.testActionPassed || (!lifecycle.connectionTestPassed && !key?.lastUsedAt)}
                onClick={() => goToStep(6)}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 6 ? (
          <section className="asw-panel ds-panel">
            <h2 className="asw-step-title">Step 6 — Activate agent</h2>

            {lifecycle.activated && activation.allComplete ? (
              <>
                <div className="asw-success-badge">
                  <CheckCircle2 className="h-4 w-4" />
                  Your agent is protected
                </div>
                <dl className="asw-status-grid">
                  <div>
                    <dt>Connection</dt>
                    <dd>{activation.connection}</dd>
                  </div>
                  <div>
                    <dt>Protection</dt>
                    <dd>{activation.protection}</dd>
                  </div>
                  <div>
                    <dt>Test</dt>
                    <dd>{activation.test}</dd>
                  </div>
                </dl>
                <SecurityPipeline compact />
                <div className="asw-nav">
                  <Link
                    href={`/agents/${encodeURIComponent(agentId)}`}
                    className="ds-btn ds-btn-primary"
                  >
                    Open Agent Dashboard →
                  </Link>
                  <Link href="/audit" className="ds-btn ds-btn-secondary">
                    Monitor Activity →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="asw-explain">
                  Review your setup status. Activation is only available when all steps are
                  honestly completed.
                </p>
                <dl className="asw-status-grid">
                  <div>
                    <dt>Connection</dt>
                    <dd className={activation.connection === "Connected" ? "asw-ok" : "asw-pending"}>
                      {activation.connection}
                    </dd>
                  </div>
                  <div>
                    <dt>Protection</dt>
                    <dd className={activation.protection === "Active" ? "asw-ok" : "asw-pending"}>
                      {activation.protection}
                    </dd>
                  </div>
                  <div>
                    <dt>Test</dt>
                    <dd className={activation.test === "Passed" ? "asw-ok" : "asw-pending"}>
                      {activation.test}
                    </dd>
                  </div>
                </dl>
                {!activation.allComplete ? (
                  <p className="asw-warn" role="note">
                    Complete the missing steps above before activating. Status reflects what
                    you have actually done — not assumed defaults.
                  </p>
                ) : null}
                <div className="asw-nav">
                  <Button variant="ghost" icon={ArrowLeft} onClick={() => goToStep(5)}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    loading={activating}
                    disabled={!canActivateAgent(lifecycle, key)}
                    onClick={handleActivate}
                  >
                    Activate Agent
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>
      <AgentCreatedToast />
    </PageShell>
  );
}
