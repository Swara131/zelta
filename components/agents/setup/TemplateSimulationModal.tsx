"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { readJsonResponse } from "@/lib/ux/fetch-json";
import type { DemoAction, DemoScenario, SimulationRun } from "@/lib/templates/simulation/types";
import { SIMULATION_DISCLAIMER } from "@/lib/templates/simulation/types";
import SimulationErrorBoundary from "./SimulationErrorBoundary";

interface TemplateSimulationModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  templateSlug?: string | null;
  onClose: () => void;
  onCompleted?: () => void;
}

export default function TemplateSimulationModal({
  open,
  agentId,
  agentName,
  templateSlug,
  onClose,
  onCompleted,
}: TemplateSimulationModalProps) {
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [actionId, setActionId] = useState<string>("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const selectedAction: DemoAction | null =
    scenario?.actions.find((item) => item.id === actionId) ?? scenario?.actions[0] ?? null;

  const hydrate = useCallback(async () => {
    if (!open || !agentId) return;
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const response = await fetch(`/api/v1/agents/${encodeURIComponent(agentId)}/simulation`);
      const payload = await readJsonResponse<{
        scenario?: DemoScenario;
        lastRun?: SimulationRun | null;
        error?: string;
      }>(response);
      if (response.status === 404) {
        setMissing(true);
        setScenario(null);
        setError(payload.error ?? "This agent is not linked to a template simulation.");
        return;
      }
      if (!response.ok || !payload.scenario) {
        throw new Error(payload.error ?? "Could not load this template’s simulation.");
      }
      setScenario(payload.scenario);
      setActionId((current) => current || payload.scenario!.actions[0]?.id || "");
      setInputs((current) => {
        if (Object.keys(current).length > 0) return current;
        const next: Record<string, string> = {};
        for (const field of payload.scenario!.inputFields) {
          next[field.id] = field.example;
        }
        return next;
      });
      if (payload.lastRun) setRun(payload.lastRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load simulation.");
    } finally {
      setLoading(false);
    }
  }, [open, agentId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const runSimulation = async () => {
    if (!selectedAction) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/agents/${encodeURIComponent(agentId)}/simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: selectedAction.id, inputs }),
      });
      const payload = await readJsonResponse<{ run?: SimulationRun; error?: string }>(response);
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Simulation evaluation failed.");
      }
      setRun(payload.run);
      if (payload.run.status === "completed") onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation evaluation failed.");
    } finally {
      setPending(false);
    }
  };

  const decide = async (decision: "approve" | "reject") => {
    if (!run) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/agents/${encodeURIComponent(agentId)}/simulation/${encodeURIComponent(run.id)}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      const payload = await readJsonResponse<{ run?: SimulationRun; error?: string }>(response);
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Could not record that decision.");
      }
      setRun(payload.run);
      if (payload.run.status === "completed") onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that decision.");
    } finally {
      setPending(false);
    }
  };

  const title = scenario?.title ?? (templateSlug ? `${templateSlug} simulation` : `${agentName} simulation`);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      variant="center"
      size="xl"
      dismissible
      panelClassName="sim-modal-panel"
      bodyClassName="sim-modal-body"
      footerClassName="sim-modal-footer"
      footer={
        <>
          <button type="button" className="sim-modal-close-btn" onClick={onClose}>
            Close
          </button>
          <Link href={`/agents/${encodeURIComponent(agentId)}/workflow`} className="ds-btn ds-btn-ghost">
            Open workflow
          </Link>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            disabled={pending || !scenario}
            onClick={() => {
              setRun(null);
              void runSimulation();
            }}
          >
            Run again
          </button>
        </>
      }
    >
      <SimulationErrorBoundary>
        <span className="sim-demo-badge">Simulation</span>
        {loading ? <p className="ds-caption">Loading this template’s sandbox…</p> : null}
        {missing ? (
          <div>
            <p className="sim-error" role="alert">
              {error}
            </p>
            <Link href="/dashboard/templates" className="ds-btn ds-btn-secondary mt-3">
              Back to templates
            </Link>
          </div>
        ) : null}

        {scenario ? (
          <div className="sim-form">
            <p className="sim-subtitle">{scenario.description}</p>
            <p className="sim-hint">{scenario.whatItDoes}</p>
            <p className="sim-hint">{scenario.whatItWillNotDo}</p>
            <p className="sim-embedded-note" role="note">
              Mode: Simulation — safe sample data only. Live mode is not available here.
            </p>

            <p className="sim-label">Workflow preview</p>
            <ol className="sim-pipeline">
              {scenario.expectedSteps.map((step) => (
                <li key={step.id} className="sim-pipeline-item">
                  <div className="sim-pipeline-step">{step.label}</div>
                </li>
              ))}
            </ol>

            <fieldset className="sim-field">
              <legend className="sim-label">Actions for this template</legend>
              <div className="sim-action-grid">
                {scenario.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`sim-action-btn ${actionId === action.id ? "sim-action-btn-active" : ""}`}
                    onClick={() => {
                      setActionId(action.id);
                      if (run && run.actionId !== action.id) setRun(null);
                    }}
                  >
                    {action.label}
                    <span className="sim-scenario-hint">{action.riskLevel} risk</span>
                  </button>
                ))}
              </div>
              <p className="sim-hint">{selectedAction?.description}</p>
            </fieldset>

            {scenario.inputFields.map((field) => (
              <label key={field.id} className="sim-field">
                <span className="sim-label">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    className="ds-input w-full"
                    rows={3}
                    value={inputs[field.id] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      setInputs((current) => ({ ...current, [field.id]: event.target.value }));
                      if (run?.status === "approval_required") setRun(null);
                    }}
                  />
                ) : (
                  <input
                    className="ds-input w-full"
                    value={inputs[field.id] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      setInputs((current) => ({ ...current, [field.id]: event.target.value }));
                      if (run?.status === "approval_required") setRun(null);
                    }}
                  />
                )}
              </label>
            ))}

            <div className="sim-field">
              <p className="sim-label">Safety preview</p>
              <p className="sim-hint">
                Permission: sandbox only. Approval:{" "}
                {selectedAction?.requiresApproval || selectedAction?.riskLevel === "high"
                  ? "required for this action"
                  : "not required for this low-risk action"}
                . Execution limit: one simulated run at a time.
              </p>
            </div>

            {error && !missing ? (
              <p className="sim-error" role="alert">
                {error}
                {run?.correlationId ? ` (ref ${run.correlationId})` : null}
              </p>
            ) : null}

            <button
              type="button"
              className="ds-btn ds-btn-primary sim-run-btn"
              disabled={pending || !selectedAction}
              onClick={() => void runSimulation()}
            >
              {pending ? "Evaluating…" : "Run simulation"}
            </button>

            {run ? (
              <div className="sim-result-wrap" aria-live="polite">
                <p className="sim-verdict-decision">Status: {run.status.replaceAll("_", " ")}</p>
                {run.status === "approval_required" && run.pending ? (
                  <article className="sim-outcome ds-panel">
                    <p className="sim-outcome-title">Approval required</p>
                    <p className="sim-outcome-desc">{run.pending.reason}</p>
                    <dl className="sim-verdict-grid">
                      <div>
                        <dt>Action</dt>
                        <dd>{selectedAction?.label}</dd>
                      </div>
                      <div>
                        <dt>Agent</dt>
                        <dd>{agentName}</dd>
                      </div>
                      <div>
                        <dt>Tool (simulated)</dt>
                        <dd>{selectedAction?.simulatedTool}</dd>
                      </div>
                      <div>
                        <dt>Policy</dt>
                        <dd>{run.pending.policy}</dd>
                      </div>
                    </dl>
                    <div className="sim-review-actions">
                      <button
                        type="button"
                        className="ds-btn ds-btn-primary"
                        disabled={pending}
                        onClick={() => void decide("approve")}
                      >
                        Approve simulation
                      </button>
                      <button
                        type="button"
                        className="ds-btn ds-btn-secondary"
                        disabled={pending}
                        onClick={() => void decide("reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ) : null}

                {run.steps.length > 0 ? (
                  <ol className="sim-pipeline">
                    {run.steps.map((step) => (
                      <li key={step.id} className="sim-pipeline-item">
                        <div className={`sim-pipeline-step ${step.status === "succeeded" ? "sim-pipeline-step-done" : ""}`}>
                          {step.label} — {step.status}
                        </div>
                        <p className="sim-hint">{step.output}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {run.resultSummary ? <p className="sim-outcome-desc">{run.resultSummary}</p> : null}
                <p className="sim-outcome-note">{SIMULATION_DISCLAIMER}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </SimulationErrorBoundary>
    </Modal>
  );
}
