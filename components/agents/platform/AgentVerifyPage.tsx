"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import type { AgentPlatformLifecycle } from "@/lib/agents/platform/lifecycle-types";

export default function AgentVerifyPage() {
  const params = useParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  const [lifecycle, setLifecycle] = useState<AgentPlatformLifecycle | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const runVerify = useCallback(async () => {
    if (!agentId) return;
    setVerifying(true);
    const response = await fetch(
      `/api/v1/agents/${encodeURIComponent(agentId)}/platform/verify`,
      { method: "POST" }
    );
    const payload = (await response.json()) as {
      lifecycle?: AgentPlatformLifecycle;
      readyToDeploy?: boolean;
    };
    setLifecycle(payload.lifecycle ?? null);
    setReady(Boolean(payload.readyToDeploy));
    setVerifying(false);
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    void runVerify();
  }, [runVerify]);

  const failures = lifecycle?.checks.filter((check) => check.status === "fail") ?? [];
  const allPass = lifecycle?.checks.every((check) => check.status === "pass") ?? false;

  return (
    <PageShell maxWidth="5xl" className="zplat-page">
      <header className="zplat-test-header">
        <h1>Agent Verification</h1>
        <Link href={`/agents/${encodeURIComponent(agentId)}/test`} className="zplat-btn zplat-btn-secondary">
          Run tests first
        </Link>
      </header>

      {loading || verifying ? (
        <p className="zplat-loading"><Loader2 className="h-5 w-5 animate-spin" /> Verifying…</p>
      ) : (
        <>
          <section className="zplat-verify-result ds-panel">
            {allPass && ready ? (
              <>
                <h2>✓ Agent is ready for deployment</h2>
                <p>All required verification checks passed.</p>
              </>
            ) : (
              <>
                <h2>⚠ Agent needs attention</h2>
                <ul>
                  {failures.map((check) => (
                    <li key={check.id}>
                      ❌ {check.label}: {check.message}
                      {check.fixHref ? (
                        <>
                          {" "}
                          <Link href={check.fixHref}>{check.fixLabel ?? "Fix"}</Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="zplat-checklist ds-panel">
            <h2>Verification pipeline</h2>
            <ol className="zplat-pipeline">
              {lifecycle?.checks.map((check) => (
                <li key={check.id} className={`zplat-pipeline-step zplat-check-${check.status}`}>
                  {check.status === "pass" ? "✓" : check.status === "fail" ? "❌" : "○"} {check.label}
                </li>
              ))}
            </ol>
          </section>

          <div className="zplat-actions-row">
            <button type="button" className="zplat-btn zplat-btn-secondary" onClick={() => void runVerify()}>
              Re-verify
            </button>
            <Link
              href={`/agents/${encodeURIComponent(agentId)}/deploy`}
              className={`zplat-btn zplat-btn-primary${ready ? "" : " is-disabled"}`}
              aria-disabled={!ready}
            >
              Continue to Deploy
            </Link>
          </div>
        </>
      )}
    </PageShell>
  );
}
