"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldBan,
  XCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  formatActionHeadline,
  formatSimulatorDecision,
  formatSimulatorPolicy,
  formatSimulatorRisk,
  getSimulatorAction,
  SIMULATOR_ACTIONS,
  SIMULATOR_PIPELINE_STEPS,
  SIMULATOR_QUICK_SCENARIOS,
  type SimulatorActionType,
} from "@/lib/agent-builder/action-simulator-config";
import { DEMO_SAFETY_DISCLAIMER } from "@/lib/safety-check/demo-action-catalog";
import type { SafetyCheckResult } from "@/lib/safety-check/evaluate-safety-check";
import { markAgentTested } from "@/lib/agent-builder/agent-onboarding";

type ReviewOutcome = "pending" | "approved" | "blocked";

interface AgentActionSimulatorProps {
  agentId: string;
  agentName: string;
  onTestComplete?: () => void;
  /** Compact layout for use inside modals */
  embedded?: boolean;
  /** Hide inline run button (e.g. when modal footer owns the action) */
  hideRunButton?: boolean;
  onRunningChange?: (running: boolean) => void;
}

export interface AgentActionSimulatorHandle {
  run: () => Promise<void>;
}

function decisionTone(decision: SafetyCheckResult["decision"]): string {
  switch (decision) {
    case "ALLOW":
      return "sim-verdict-allow";
    case "REVIEW":
      return "sim-verdict-review";
    case "BLOCK":
      return "sim-verdict-block";
  }
}

function DecisionIcon({ decision }: { decision: SafetyCheckResult["decision"] }) {
  switch (decision) {
    case "ALLOW":
      return <CheckCircle2 className="h-8 w-8" strokeWidth={2} aria-hidden="true" />;
    case "REVIEW":
      return <ShieldAlert className="h-8 w-8" strokeWidth={2} aria-hidden="true" />;
    case "BLOCK":
      return <ShieldBan className="h-8 w-8" strokeWidth={2} aria-hidden="true" />;
  }
}

const AgentActionSimulator = forwardRef<AgentActionSimulatorHandle, AgentActionSimulatorProps>(
  function AgentActionSimulator(
    {
      agentId,
      agentName,
      onTestComplete,
      embedded = false,
      hideRunButton = false,
      onRunningChange,
    },
    ref
  ) {
  const [actionType, setActionType] = useState<SimulatorActionType>("refund");
  const [amountInr, setAmountInr] = useState("25000");
  const [customerName, setCustomerName] = useState("Demo Customer");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOutcome, setReviewOutcome] = useState<ReviewOutcome>("pending");
  const [actionHeadline, setActionHeadline] = useState<string | null>(null);

  const selectedAction = useMemo(() => getSimulatorAction(actionType), [actionType]);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  useEffect(() => {
    if (selectedAction.showAmount && selectedAction.defaultAmountInr != null) {
      setAmountInr(String(selectedAction.defaultAmountInr));
    }
  }, [selectedAction]);

  const resetRun = () => {
    setResult(null);
    setActiveStep(null);
    setReviewOutcome("pending");
    setActionHeadline(null);
    setError(null);
  };

  const applyScenario = (scenarioId: string) => {
    const scenario = SIMULATOR_QUICK_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    resetRun();
    setActionType(scenario.actionType);
    if ("amountInr" in scenario && scenario.amountInr != null) {
      setAmountInr(String(scenario.amountInr));
    }
  };

  const runPipelineAnimation = useCallback(() => {
    setActiveStep(0);
    const timers: number[] = [];
    for (let i = 1; i < SIMULATOR_PIPELINE_STEPS.length; i += 1) {
      timers.push(window.setTimeout(() => setActiveStep(i), i * 550));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setReviewOutcome("pending");

    const parsedAmount = selectedAction.showAmount ? Number(amountInr) : null;
    if (selectedAction.showAmount && (!Number.isFinite(parsedAmount) || parsedAmount! < 0)) {
      setError("Enter a valid amount.");
      setRunning(false);
      return;
    }

    const headline = formatActionHeadline(
      selectedAction,
      parsedAmount,
      customerName.trim() || "Demo Customer"
    );
    setActionHeadline(headline);

    const cleanup = runPipelineAnimation();

    try {
      const response = await fetch("/api/safety-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          actionId: selectedAction.actionId,
          customerId: customerName.trim() || "Demo Customer",
          reason: selectedAction.defaultReason,
          amountInr: parsedAmount,
        }),
      });

      const payload = (await response.json()) as {
        result?: SafetyCheckResult;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Safety check failed.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, SIMULATOR_PIPELINE_STEPS.length * 550 + 200));

      setResult(payload.result ?? null);
      setActiveStep(SIMULATOR_PIPELINE_STEPS.length - 1);
      markAgentTested(agentId);
      onTestComplete?.();
    } catch (err) {
      cleanup();
      setActiveStep(null);
      setError(err instanceof Error ? err.message : "Safety check failed.");
    } finally {
      setRunning(false);
    }
  }, [
    agentId,
    agentName,
    amountInr,
    customerName,
    onTestComplete,
    runPipelineAnimation,
    selectedAction,
  ]);

  useImperativeHandle(ref, () => ({ run: handleRun }), [handleRun]);

  const showReviewActions = result?.decision === "REVIEW" && reviewOutcome === "pending";
  const showStoppedMessage =
    result && (result.decision === "REVIEW" || result.decision === "BLOCK");

  return (
    <section
      className={`sim-panel ${embedded ? "sim-panel-embedded" : "ds-panel"}`}
      aria-labelledby={embedded ? undefined : "sim-heading"}
    >
      {!embedded ? (
        <header className="sim-header">
          <div>
            <h2 id="sim-heading" className="sim-title">
              Test an Agent Action
            </h2>
            <p className="sim-subtitle">
              See your AI agent request an action and watch Wave decide whether to allow it, ask
              you first, or block it — before anything runs for real.
            </p>
          </div>
          <p className="sim-demo-badge" role="note">
            {DEMO_SAFETY_DISCLAIMER}
          </p>
        </header>
      ) : (
        <p className="sim-embedded-note" role="note">
          {DEMO_SAFETY_DISCLAIMER}
        </p>
      )}

      <div className={`sim-layout ${embedded ? "sim-layout-embedded" : ""}`}>
        <div className="sim-form">
          <fieldset className="sim-field">
            <legend className="sim-label">Select action</legend>
            <div className="sim-action-grid">
              {SIMULATOR_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`sim-action-btn ${actionType === action.id ? "sim-action-btn-active" : ""}`}
                  onClick={() => {
                    resetRun();
                    setActionType(action.id);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <p className="sim-hint">{selectedAction.description}</p>
          </fieldset>

          {selectedAction.showAmount ? (
            <label className="sim-field">
              <span className="sim-label">Amount</span>
              <div className="sim-amount-wrap">
                <span className="sim-currency" aria-hidden="true">
                  ₹
                </span>
                <input
                  className="ds-input sim-amount-input"
                  type="number"
                  min={0}
                  value={amountInr}
                  onChange={(e) => {
                    resetRun();
                    setAmountInr(e.target.value);
                  }}
                  placeholder="25000"
                />
              </div>
            </label>
          ) : null}

          <label className="sim-field">
            <span className="sim-label">Customer</span>
            <input
              className="ds-input w-full"
              value={customerName}
              onChange={(e) => {
                resetRun();
                setCustomerName(e.target.value);
              }}
              placeholder="Demo Customer"
            />
          </label>

          <div className="sim-scenarios">
            <p className="sim-label">Try a demo scenario</p>
            <div className="sim-scenario-btns">
              {SIMULATOR_QUICK_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className="sim-scenario-btn"
                  onClick={() => applyScenario(scenario.id)}
                >
                  <span>{scenario.label}</span>
                  <span className="sim-scenario-hint">{scenario.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="sim-error" role="alert">
              {error}
            </p>
          ) : null}

          {!hideRunButton ? (
            <Button
              variant="primary"
              size="lg"
              icon={Shield}
              loading={running}
              className={`sim-run-btn ${embedded ? "sim-run-btn-embedded" : ""}`}
              onClick={() => void handleRun()}
            >
              Run Through Wave
            </Button>
          ) : null}
        </div>

        {!embedded || running || result ? (
          <div className="sim-pipeline-wrap">
          <h3 className="sim-side-title">Decision pipeline</h3>
          <ol className="sim-pipeline" aria-label="Wave evaluation pipeline">
            {SIMULATOR_PIPELINE_STEPS.map((step, index) => {
              const isActive = activeStep === index;
              const isDone = activeStep != null && index < activeStep;
              return (
                <li key={step.id} className="sim-pipeline-item">
                  <div
                    className={`sim-pipeline-step ${isActive ? "sim-pipeline-step-active" : ""} ${isDone ? "sim-pipeline-step-done" : ""}`}
                  >
                    <span className="sim-pipeline-dot" aria-hidden="true" />
                    <span>{step.label}</span>
                  </div>
                  {index < SIMULATOR_PIPELINE_STEPS.length - 1 ? (
                    <span className="sim-pipeline-arrow" aria-hidden="true">
                      ↓
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {!result && !running ? (
            <p className="sim-pipeline-hint">
              Click <strong>Run Through Wave</strong> to animate how an agent action is evaluated.
            </p>
          ) : null}

          {running && !result ? (
            <p className="sim-pipeline-running">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Evaluating action…
            </p>
          ) : null}
        </div>
        ) : null}
      </div>

      {result && actionHeadline ? (
        <div className="sim-result-wrap" aria-live="polite">
          <article className={`sim-verdict ds-panel ${decisionTone(result.decision)}`}>
            <div className="sim-verdict-icon" aria-hidden="true">
              <DecisionIcon decision={result.decision} />
            </div>
            <p className="sim-verdict-action">{actionHeadline}</p>
            <dl className="sim-verdict-grid">
              <div>
                <dt>Policy</dt>
                <dd>{formatSimulatorPolicy(result.decision)}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{formatSimulatorRisk(result.riskLevel)}</dd>
              </div>
              <div>
                <dt>Risk score</dt>
                <dd>{result.riskScore}%</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd className="sim-verdict-decision">
                  {formatSimulatorDecision(result.decision)}
                </dd>
              </div>
            </dl>
          </article>

          {result.decision === "ALLOW" ? (
            <article className="sim-outcome sim-outcome-allow ds-panel">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2} />
              <div>
                <p className="sim-outcome-title">✓ Allowed automatically</p>
                <p className="sim-outcome-desc">
                  Wave allowed this action. In production, the agent could proceed without waiting
                  for you.
                </p>
                <p className="sim-outcome-note">{DEMO_SAFETY_DISCLAIMER}</p>
              </div>
            </article>
          ) : null}

          {showStoppedMessage && reviewOutcome === "pending" ? (
            <>
              <p className="sim-stopped-msg">
                Wave stopped the action before execution.
              </p>
              {showReviewActions ? (
                <div className="sim-review-actions">
                  <button
                    type="button"
                    className="ds-btn ds-btn-primary"
                    onClick={() => setReviewOutcome("approved")}
                  >
                    Approve Action
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn-secondary"
                    onClick={() => setReviewOutcome("blocked")}
                  >
                    Block Action
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {result.decision === "BLOCK" && reviewOutcome === "pending" ? (
            <article className="sim-outcome sim-outcome-block ds-panel">
              <XCircle className="h-5 w-5 text-red-400" strokeWidth={2} />
              <div>
                <p className="sim-outcome-title">✕ Blocked</p>
                <p className="sim-outcome-desc">Execution prevented by Wave.</p>
                <p className="sim-outcome-note">{DEMO_SAFETY_DISCLAIMER}</p>
              </div>
            </article>
          ) : null}

          {reviewOutcome === "approved" ? (
            <article className="sim-outcome sim-outcome-allow ds-panel">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2} />
              <div>
                <p className="sim-outcome-title">✓ Approved</p>
                <ul className="sim-outcome-list">
                  <li>Execution token issued</li>
                  <li>Token expires in 5 minutes</li>
                  <li>Action ready for execution</li>
                </ul>
                <p className="sim-outcome-note">{DEMO_SAFETY_DISCLAIMER}</p>
              </div>
            </article>
          ) : null}

          {reviewOutcome === "blocked" ? (
            <article className="sim-outcome sim-outcome-block ds-panel">
              <XCircle className="h-5 w-5 text-red-400" strokeWidth={2} />
              <div>
                <p className="sim-outcome-title">✕ Blocked</p>
                <p className="sim-outcome-desc">Execution prevented by Wave.</p>
                <p className="sim-outcome-note">{DEMO_SAFETY_DISCLAIMER}</p>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});

export default AgentActionSimulator;
