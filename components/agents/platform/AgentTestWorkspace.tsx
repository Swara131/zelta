"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import AgentWorkflowCanvas from "@/components/agents/workspace/AgentWorkflowCanvas";
import { buildWorkflowFromAgent } from "@/lib/agents/workflow-nodes";
import AgentResultRenderer from "@/components/agents/results/AgentResultRenderer";
import type {
  AgentPlatformLifecycle,
  PlatformCheckResult,
} from "@/lib/agents/platform/lifecycle-types";
import type { AgentRequirement, AgentRequirementsResult } from "@/lib/agents/requirements/types";

function failedChecks(lifecycle: AgentPlatformLifecycle | null): PlatformCheckResult[] {
  return (lifecycle?.checks ?? []).filter((check) => check.status === "fail");
}

function failureReason(
  lifecycle: AgentPlatformLifecycle | null,
  extras: Array<string | null | undefined> = []
): string | null {
  const fromChecks = failedChecks(lifecycle)
    .map((check) => check.message?.trim())
    .filter((message): message is string => Boolean(message));
  const fromExtras = extras
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const unique = [...new Set([...fromExtras, ...fromChecks])];
  return unique.length > 0 ? unique.join(" ") : null;
}

export default function AgentTestWorkspace() {
  const params = useParams();
  const router = useRouter();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const [requirements, setRequirements] = useState<AgentRequirementsResult | null>(null);
  const [lifecycle, setLifecycle] = useState<AgentPlatformLifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [runFailed, setRunFailed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preparing" | "running">("idle");

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const [reqRes, verifyRes] = await Promise.all([
        fetch(`/api/v1/agents/${encodeURIComponent(agentId)}/requirements?stage=test`),
        fetch(`/api/v1/agents/${encodeURIComponent(agentId)}/platform/verify`),
      ]);
      const reqPayload = (await reqRes.json()) as AgentRequirementsResult;
      const verifyPayload = (await verifyRes.json()) as { lifecycle?: AgentPlatformLifecycle };
      setRequirements(reqPayload);
      const nextLifecycle = verifyPayload.lifecycle ?? null;
      setLifecycle(nextLifecycle);
      const storedReason = failureReason(nextLifecycle);
      if (storedReason) {
        setRunFailed(true);
        setError(storedReason);
      }
      if (!reqPayload.ready) {
        router.replace(`/agents/${encodeURIComponent(agentId)}/prepare`);
      }
    } catch {
      setError("Could not load the test workspace.");
    } finally {
      setLoading(false);
    }
  }, [agentId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const runFullTest = async () => {
    if (!agentId) return;
    setRunning(true);
    setPhase("preparing");
    setError(null);
    setRunSummary(null);
    setRunFailed(false);
    window.setTimeout(() => setPhase("running"), 280);
    try {
      const response = await fetch(
        `/api/v1/agents/${encodeURIComponent(agentId)}/platform/test`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const payload = (await response.json()) as {
        success?: boolean;
        lifecycle?: AgentPlatformLifecycle;
        runSummary?: string | null;
        runError?: string | null;
        error?: string;
        missing?: AgentRequirement[];
      };
      if (payload.missing?.length) {
        router.replace(`/agents/${encodeURIComponent(agentId)}/prepare`);
        return;
      }
      setLifecycle(payload.lifecycle ?? null);
      const reason = failureReason(payload.lifecycle ?? null, [
        payload.runError,
        payload.error,
      ]);
      if (!response.ok || payload.success === false || payload.runError) {
        setRunFailed(true);
        setRunSummary(payload.runSummary ?? null);
        throw new Error(reason ?? "The test run failed.");
      }
      setRunSummary(payload.runSummary ?? "Test completed successfully.");
      setRunFailed(false);
    } catch (err) {
      setRunFailed(true);
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setRunning(false);
      setPhase("idle");
    }
  };

  const execution = lifecycle?.checks.find((check) => check.id === "execution");
  const failed = failedChecks(lifecycle);
  const reason = error ?? failureReason(lifecycle);
  const fixCheck = failed.find((check) => check.fixHref);
  const executionStatus = runFailed || execution?.status === "fail"
    ? "fail"
    : runSummary || execution?.status === "pass"
      ? "pass"
      : "not_run";

  if (loading || (requirements && !requirements.ready)) {
    return (
      <PageShell maxWidth="7xl" className="zplat-page ztest-page">
        <Skeleton lines={4} />
      </PageShell>
    );
  }

  const checks = lifecycle?.checks ?? [];

  return (
    <PageShell maxWidth="7xl" className="zplat-page ztest-page">
      <header className="prep-header ztest-header">
        <div>
          <p className="prep-kicker">Test environment</p>
          <h1>{requirements?.agentName ?? agentId}</h1>
        </div>
        <StatusBadge tone={requirements?.ready ? "success" : "warning"}>
          {requirements?.ready ? "Ready" : "Not ready"}
        </StatusBadge>
        <Link href={`/agents/${encodeURIComponent(agentId)}/prepare`} className="zplat-btn zplat-btn-ghost">
          Edit setup
        </Link>
      </header>

      <div className="ztest-layout">
        <section className="ds-panel ztest-input">
          <h2>Input</h2>
          <p className="ztest-lead">
            Run a live test. Wave will execute the agent, show each step, and pause if
            approval is required.
          </p>
          <ul className="prep-ready-list">
            {(requirements?.requirements ?? [])
              .filter((item) => item.required)
              .map((item) => (
                <li key={item.key}>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  {item.label}
                </li>
              ))}
          </ul>
          <button
            type="button"
            className="prep-btn prep-btn-primary"
            disabled={running}
            onClick={() => void runFullTest()}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === "preparing" ? "Preparing…" : "Running…"}
              </>
            ) : (
              "Run Test"
            )}
          </button>
          {runSummary && !runFailed ? (
            <AgentResultRenderer
              result={runSummary}
              status="completed"
              onRetry={() => void runFullTest()}
            />
          ) : null}
          {error || executionStatus === "fail" ? (
            <ErrorState
              title="Wave couldn't finish this test."
              description={reason ?? "The agent stopped before producing a result."}
              fixLabel={fixCheck?.fixLabel ?? "Fix connection"}
              fixHref={fixCheck?.fixHref}
              onFix={() => void runFullTest()}
              technical={execution?.message ?? error}
            />
          ) : null}
        </section>

        <section className="ds-panel ztest-live">
          <h2>Live workflow</h2>
          <ol className="ztest-steps">
            {checks.length === 0 ? (
              <li className="ztest-step is-idle">
                <span>○</span>
                Waiting to start
              </li>
            ) : (
              checks.map((check) => (
                <li
                  key={check.id}
                  className={`ztest-step is-${running && check.status === "not_run" ? "running" : check.status}`}
                >
                  <span aria-hidden="true">
                    {check.status === "pass" ? (
                      <Check className="h-4 w-4" />
                    ) : check.status === "fail" ? (
                      <X className="h-4 w-4" />
                    ) : running ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "○"
                    )}
                  </span>
                  <div>
                    <strong>{check.label}</strong>
                    <small>
                      {check.message ??
                        (check.status === "pass"
                          ? "Completed"
                          : check.status === "fail"
                            ? "Needs attention"
                            : running
                              ? "Running"
                              : "Idle")}
                    </small>
                  </div>
                </li>
              ))
            )}
          </ol>
          <div className="ztest-canvas">
            <AgentWorkflowCanvas
              nodes={buildWorkflowFromAgent({
                name: requirements?.agentName ?? agentId,
                goal: null,
                instructions: null,
                tools: [],
                capabilityLabels: [],
                protected: true,
              })}
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
