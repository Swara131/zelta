"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  Shield,
  ShieldAlert,
  ShieldBan,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import {
  DEMO_ACTION_CATALOG,
  DEMO_AGENT_ID,
  DEMO_AGENT_NAME,
  DEMO_SAFETY_DISCLAIMER,
  type DemoActionId,
} from "@/lib/safety-check/demo-action-catalog";
import type { SafetyCheckResult } from "@/lib/safety-check/evaluate-safety-check";
import { markAgentTested } from "@/lib/agent-builder/agent-onboarding";
import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";

interface AgentOption {
  id: string;
  name: string;
}

const FLOW_STEPS = [
  { id: "propose", label: "Agent proposes action" },
  { id: "policy", label: "Wave checks policy" },
  { id: "risk", label: "Risk analysis" },
  { id: "decision", label: "Decision" },
  { id: "outcome", label: "Allow / Approval / Block" },
] as const;

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load agents.");
  }
  return payload.keys ?? [];
}

function formatRiskLevel(level: string): string {
  return level.toUpperCase();
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SafetyVerdictIcon({
  decision,
}: {
  decision: SafetyCheckResult["decision"];
}) {
  switch (decision) {
    case "ALLOW":
      return <CheckCircle2 className="h-8 w-8" strokeWidth={2} />;
    case "REVIEW":
      return <ShieldAlert className="h-8 w-8" strokeWidth={2} />;
    case "BLOCK":
      return <ShieldBan className="h-8 w-8" strokeWidth={2} />;
  }
}

export default function TestActionPage() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agent")?.trim() ?? "";

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const [agentId, setAgentId] = useState(DEMO_AGENT_ID);
  const [actionId, setActionId] = useState<DemoActionId>("issue_refund");
  const [amountInr, setAmountInr] = useState("25000");
  const [customerId, setCustomerId] = useState("cus_12345");
  const [reason, setReason] = useState("Customer requested a refund for a delayed shipment.");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [activeFlowStep, setActiveFlowStep] = useState<number | null>(null);

  const selectedAction = useMemo(
    () => DEMO_ACTION_CATALOG.find((action) => action.id === actionId) ?? DEMO_ACTION_CATALOG[0]!,
    [actionId]
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0],
    [agents, agentId]
  );

  useEffect(() => {
    void fetchAgentKeys()
      .then((keys) => {
        const active = keys.filter((key) => !key.revokedAt);
        const options: AgentOption[] = [
          { id: DEMO_AGENT_ID, name: DEMO_AGENT_NAME },
          ...active.map((key) => ({
            id: key.agentId,
            name: key.name?.trim() && key.name !== key.agentId
              ? key.name
              : humanizeAgentLabel(key.agentId, key.name),
          })),
        ];

        const unique = options.filter(
          (option, index, list) => list.findIndex((item) => item.id === option.id) === index
        );

        setAgents(unique);

        if (initialAgentId && unique.some((option) => option.id === initialAgentId)) {
          setAgentId(initialAgentId);
        }
      })
      .catch(() => {
        setAgents([{ id: DEMO_AGENT_ID, name: DEMO_AGENT_NAME }]);
      })
      .finally(() => setAgentsLoading(false));
  }, [initialAgentId]);

  useEffect(() => {
    if (selectedAction.defaultAmountInr != null) {
      setAmountInr(String(selectedAction.defaultAmountInr));
    }
  }, [selectedAction]);

  const runFlowAnimation = useCallback(() => {
    setActiveFlowStep(0);
    const timers: number[] = [];
    for (let step = 1; step < FLOW_STEPS.length; step += 1) {
      timers.push(window.setTimeout(() => setActiveFlowStep(step), step * 450));
    }
    timers.push(
      window.setTimeout(() => {
        setActiveFlowStep(FLOW_STEPS.length - 1);
      }, FLOW_STEPS.length * 450)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAgent) return;

    setRunning(true);
    setError(null);
    setResult(null);
    const cleanup = runFlowAnimation();

    try {
      const parsedAmount = selectedAction.showAmount ? Number(amountInr) : null;
      if (selectedAction.showAmount && (!Number.isFinite(parsedAmount) || parsedAmount! < 0)) {
        throw new Error("Enter a valid amount.");
      }

      const response = await fetch("/api/safety-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          actionId,
          customerId,
          reason,
          amountInr: selectedAction.showAmount ? parsedAmount : null,
        }),
      });

      const payload = (await response.json()) as {
        result?: SafetyCheckResult;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Safety check failed.");
      }

      setResult(payload.result ?? null);
      if (selectedAgent.id !== DEMO_AGENT_ID) {
        markAgentTested(selectedAgent.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Safety check failed.");
      setActiveFlowStep(null);
    } finally {
      setRunning(false);
      cleanup();
    }
  };

  return (
    <PageShell maxWidth="6xl" className="tac-page">
      <PageHeader
        icon={Play}
        title="Test an AI Agent Action"
        description="See what Wave would do before your agent performs a real action."
      />

      <div className="tac-demo-banner" role="status">
        {DEMO_SAFETY_DISCLAIMER}
      </div>

      <div className="tac-layout">
        <form className="tac-form ds-panel" onSubmit={(event) => void handleSubmit(event)}>
          <h2 className="tac-form-title">Try a sample action</h2>
          <p className="tac-form-desc">
            Pick an agent and action. Wave will evaluate it using the same protection rules as
            production — without executing anything.
          </p>

          <div className="tac-field">
            <label htmlFor="tac-agent" className="ds-label">
              Agent
            </label>
            {agentsLoading ? (
              <p className="tac-loading-inline">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading agents…
              </p>
            ) : (
              <select
                id="tac-agent"
                className="ds-input w-full"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="tac-field">
            <label htmlFor="tac-action" className="ds-label">
              Action
            </label>
            <select
              id="tac-action"
              className="ds-input w-full"
              value={actionId}
              onChange={(event) => setActionId(event.target.value as DemoActionId)}
            >
              {DEMO_ACTION_CATALOG.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
            <p className="tac-field-hint">{selectedAction.description}</p>
          </div>

          {selectedAction.showAmount ? (
            <div className="tac-field">
              <label htmlFor="tac-amount" className="ds-label">
                {selectedAction.amountLabel ?? "Amount (INR)"}
              </label>
              <input
                id="tac-amount"
                type="number"
                min={0}
                step={1}
                className="ds-input w-full"
                value={amountInr}
                onChange={(event) => setAmountInr(event.target.value)}
                placeholder={selectedAction.amountPlaceholder}
              />
            </div>
          ) : null}

          <div className="tac-field">
            <label htmlFor="tac-customer" className="ds-label">
              Customer / User ID
            </label>
            <input
              id="tac-customer"
              type="text"
              className="ds-input w-full"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="cus_12345"
            />
          </div>

          <div className="tac-field">
            <label htmlFor="tac-reason" className="ds-label">
              Description / Reason
            </label>
            <textarea
              id="tac-reason"
              className="ds-input w-full min-h-[5rem]"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is the agent trying to do this?"
            />
          </div>

          {error ? (
            <p className="tac-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={Shield}
            loading={running}
            className="tac-submit"
          >
            Run Safety Check
          </Button>
        </form>

        <div className="tac-side">
          <section className="tac-flow ds-panel" aria-label="How Wave evaluates an action">
            <h2 className="tac-side-title">What happens</h2>
            <ol className="tac-flow-list">
              {FLOW_STEPS.map((step, index) => {
                const isActive = activeFlowStep === index;
                const isDone = activeFlowStep != null && index < activeFlowStep;

                return (
                  <li key={step.id}>
                    <div
                      className={`tac-flow-step ${isActive ? "tac-flow-step-active" : ""} ${
                        isDone ? "tac-flow-step-done" : ""
                      }`}
                    >
                      <span className="tac-flow-dot" aria-hidden="true" />
                      <span>{step.label}</span>
                    </div>
                    {index < FLOW_STEPS.length - 1 ? (
                      <ArrowDown className="tac-flow-arrow" strokeWidth={2} aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          {!result && !running ? (
            <section className="tac-hint ds-panel">
              <Bot className="h-5 w-5 text-[#a5b4fc]" strokeWidth={2} aria-hidden="true" />
              <p>
                Try a ₹500 refund to see an automatic allow, ₹25,000 for approval, or delete a
                customer record to see a block.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      {result ? (
        <section className="tac-result-wrap" aria-live="polite">
          <article className={`tac-verdict tac-verdict-${result.decision.toLowerCase()} ds-panel`}>
            <div className="tac-verdict-icon" aria-hidden="true">
              {result.decision ? (
                <SafetyVerdictIcon decision={result.decision} />
              ) : (
                <Shield className="h-8 w-8" strokeWidth={2} />
              )}
            </div>
            <h2 className="tac-verdict-headline">{result.headline}</h2>
            <p className="tac-verdict-summary">{result.summary}</p>
          </article>

          <article className="tac-details ds-panel">
            <h3 className="tac-details-title">Safety check details</h3>
            <dl className="tac-details-grid">
              <div>
                <dt>Agent</dt>
                <dd>{result.agentName}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>{result.actionLabel}</dd>
              </div>
              {result.amountDisplay ? (
                <div>
                  <dt>Amount</dt>
                  <dd>{result.amountDisplay}</dd>
                </div>
              ) : null}
              <div>
                <dt>Customer / User ID</dt>
                <dd>{result.customerId}</dd>
              </div>
              <div>
                <dt>Policy decision</dt>
                <dd>{result.policyDecision}</dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>{formatRiskLevel(result.riskLevel)}</dd>
              </div>
              <div>
                <dt>Risk score</dt>
                <dd>{result.riskScore}</dd>
              </div>
              <div>
                <dt>Required approval</dt>
                <dd>{result.requiredApproval ? "Yes" : "No"}</dd>
              </div>
              <div className="tac-details-wide">
                <dt>Reason</dt>
                <dd>{result.reason}</dd>
              </div>
              {result.description ? (
                <div className="tac-details-wide">
                  <dt>Description</dt>
                  <dd>{result.description}</dd>
                </div>
              ) : null}
              <div>
                <dt>Timestamp</dt>
                <dd>{formatTimestamp(result.timestamp)}</dd>
              </div>
            </dl>

            {result.decision === "REVIEW" ? (
              <Link href="/approvals" className="ds-btn ds-btn-secondary ds-btn-sm mt-4 inline-flex">
                Review Approval
              </Link>
            ) : null}
          </article>
        </section>
      ) : null}
    </PageShell>
  );
}
