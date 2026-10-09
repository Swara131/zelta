"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldBan } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  DEMO_ACTION_CATALOG,
  type DemoActionId,
} from "@/lib/safety-check/demo-action-catalog";
import { evaluateSafetyCheck } from "@/lib/safety-check/evaluate-safety-check";
import type { SafetyCheckResult } from "@/lib/safety-check/evaluate-safety-check";

const TEST_ACTION_LABELS: Record<string, string> = {
  issue_refund: "Refund customer",
  send_email: "Send email",
  change_permissions: "Change customer account",
  delete_record: "Delete customer",
  transfer_money: "Transfer money",
};

const TEST_ACTIONS = DEMO_ACTION_CATALOG.filter((action) =>
  Object.hasOwn(TEST_ACTION_LABELS, action.id)
);

function resultTone(decision: SafetyCheckResult["decision"]): string {
  switch (decision) {
    case "ALLOW":
      return "prot-test-allow";
    case "REVIEW":
      return "prot-test-review";
    case "BLOCK":
      return "prot-test-block";
  }
}

function ResultIcon({ decision }: { decision: SafetyCheckResult["decision"] }) {
  switch (decision) {
    case "ALLOW":
      return <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />;
    case "REVIEW":
      return <ShieldAlert className="h-5 w-5" strokeWidth={2} aria-hidden="true" />;
    case "BLOCK":
      return <ShieldBan className="h-5 w-5" strokeWidth={2} aria-hidden="true" />;
  }
}

function formatTestResultLabel(decision: SafetyCheckResult["decision"]): string {
  switch (decision) {
    case "ALLOW":
      return "✓ Allowed automatically";
    case "REVIEW":
      return "⚠ Approval required";
    case "BLOCK":
      return "✕ Blocked";
  }
}

export default function ProtectionRuleTester() {
  const [actionId, setActionId] = useState<DemoActionId>("issue_refund");
  const [amountInr, setAmountInr] = useState("25000");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAction = useMemo(
    () => TEST_ACTIONS.find((action) => action.id === actionId) ?? TEST_ACTIONS[0],
    [actionId]
  );

  const handleTest = () => {
    setRunning(true);
    setError(null);
    setResult(null);

    const parsedAmount = selectedAction.showAmount ? Number(amountInr) : null;
    if (selectedAction.showAmount && (!Number.isFinite(parsedAmount) || parsedAmount! < 0)) {
      setError("Enter a valid amount.");
      setRunning(false);
      return;
    }

    window.setTimeout(() => {
      try {
        const evaluation = evaluateSafetyCheck({
          agentId: "protection-page-test",
          agentName: "Demo Agent",
          actionId: selectedAction.id,
          customerId: "Demo Customer",
          reason: "Protection page rule test.",
          amountInr: parsedAmount,
        });
        setResult(evaluation);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not evaluate this action.");
      } finally {
        setRunning(false);
      }
    }, 350);
  };

  return (
    <section className="prot-test ds-panel" aria-labelledby="prot-test-heading">
      <header className="prot-test-header">
        <h2 id="prot-test-heading" className="prot-section-title">
          Test a rule
        </h2>
        <p className="prot-section-desc prot-section-desc-tight">
          Pick an action and see which protection category it falls into — using the same rules
          Wave applies to real agent requests.
        </p>
      </header>

      <div className="prot-test-form">
        <label className="prot-test-field">
          <span className="prot-test-label">Action</span>
          <select
            className="ds-input w-full"
            value={actionId}
            onChange={(event) => {
              setActionId(event.target.value as DemoActionId);
              setResult(null);
              setError(null);
            }}
          >
            {TEST_ACTIONS.map((action) => (
              <option key={action.id} value={action.id}>
                {TEST_ACTION_LABELS[action.id] ?? action.label}
              </option>
            ))}
          </select>
        </label>

        {selectedAction.showAmount ? (
          <label className="prot-test-field">
            <span className="prot-test-label">Amount</span>
            <div className="prot-test-amount-wrap">
              <span className="prot-test-currency" aria-hidden="true">
                ₹
              </span>
              <input
                className="ds-input prot-test-amount-input w-full"
                type="number"
                min={0}
                value={amountInr}
                onChange={(event) => {
                  setAmountInr(event.target.value);
                  setResult(null);
                }}
                placeholder={selectedAction.amountPlaceholder}
              />
            </div>
          </label>
        ) : null}

        {error ? (
          <p className="prot-test-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          variant="secondary"
          loading={running}
          onClick={handleTest}
          className="prot-test-btn"
        >
          {running ? "Checking…" : "Check protection"}
        </Button>
      </div>

      {result ? (
        <article
          className={`prot-test-result ${resultTone(result.decision)}`}
          aria-live="polite"
        >
          <div className="prot-test-result-head">
            <ResultIcon decision={result.decision} />
            <div>
              <p className="prot-test-result-label">Result</p>
              <p className="prot-test-result-value">{formatTestResultLabel(result.decision)}</p>
            </div>
          </div>
          <div className="prot-test-reason">
            <p className="prot-test-reason-label">Reason</p>
            <p className="prot-test-reason-text">&ldquo;{result.reason}&rdquo;</p>
          </div>
        </article>
      ) : running ? (
        <p className="prot-test-running">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking against your protection rules…
        </p>
      ) : null}
    </section>
  );
}
