"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import type { AgentPlatformLifecycle } from "@/lib/agents/platform/lifecycle-types";
import type { DeployProgressStep } from "@/lib/agents/platform/deploy-agent";

export default function AgentDeployPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";

  const [lifecycle, setLifecycle] = useState<AgentPlatformLifecycle | null>(null);
  const [progress, setProgress] = useState<DeployProgressStep[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!agentId) return;
    const response = await fetch(
      `/api/v1/agents/${encodeURIComponent(agentId)}/platform/deploy`
    );
    const payload = (await response.json()) as {
      lifecycle?: AgentPlatformLifecycle;
      progress?: DeployProgressStep[];
      readyToDeploy?: boolean;
    };
    setLifecycle(payload.lifecycle ?? null);
    setProgress(payload.progress ?? []);
    setReady(Boolean(payload.readyToDeploy));
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deploy = async () => {
    if (!agentId || !ready) return;
    setDeploying(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/agents/${encodeURIComponent(agentId)}/platform/deploy`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        lifecycle?: AgentPlatformLifecycle;
        progress?: DeployProgressStep[];
        error?: string;
        issues?: Array<{ message: string }>;
      };
      if (!response.ok) {
        throw new Error(
          payload.error ??
            payload.issues?.map((issue) => issue.message).join(" ") ??
            "Deployment failed."
        );
      }
      setLifecycle(payload.lifecycle ?? null);
      setProgress(payload.progress ?? []);
      if (payload.lifecycle?.stage === "deployed") {
        router.push(`/agents/${encodeURIComponent(agentId)}?deployed=1`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed.");
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="5xl" className="zplat-page">
        <p className="zplat-loading"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</p>
      </PageShell>
    );
  }

  const deployment = lifecycle?.deployment;
  const hasDraft = deployment?.hasUnpublishedDraft;

  return (
    <PageShell maxWidth="5xl" className="zplat-page">
      <header className="zplat-test-header">
        <h1>Deploy Agent</h1>
        <Link href={`/agents/${encodeURIComponent(agentId)}/verify`} className="zplat-btn zplat-btn-ghost">
          ← Verification
        </Link>
      </header>

      {!ready ? (
        <section className="zplat-verify-result ds-panel">
          <h2>⚠ This agent isn&apos;t ready for deployment.</h2>
          <p>Fix verification issues before deploying.</p>
          <Link href={`/agents/${encodeURIComponent(agentId)}/verify`} className="zplat-btn zplat-btn-secondary">
            View Issues
          </Link>
        </section>
      ) : (
        <section className="zplat-deploy-panel ds-panel">
          <dl className="zplat-deploy-meta">
            <div><dt>Environment</dt><dd>Production</dd></div>
            <div><dt>Agent version</dt><dd>v{(deployment?.version ?? 0) + 1}</dd></div>
            {deployment?.previousVersion ? (
              <div><dt>Previous</dt><dd>v{deployment.previousVersion}</dd></div>
            ) : null}
            <div><dt>Safety</dt><dd>✓ Enabled</dd></div>
            <div><dt>Monitoring</dt><dd>✓ Enabled</dd></div>
          </dl>

          {hasDraft ? (
            <p className="zplat-draft-note">
              Your agent has unpublished changes (draft v{deployment?.draftVersion}).
            </p>
          ) : null}

          {progress.length > 0 ? (
            <ol className="zplat-deploy-progress">
              {progress.map((step) => (
                <li key={step.id} className={step.current ? "is-current" : step.done ? "is-done" : ""}>
                  {step.label}
                </li>
              ))}
            </ol>
          ) : null}

          <button
            type="button"
            className="zplat-btn zplat-btn-primary"
            disabled={deploying}
            onClick={() => void deploy()}
          >
            {deploying ? "Deploying…" : "Deploy"}
          </button>
          {error ? <p className="zplat-error" role="alert">{error}</p> : null}
        </section>
      )}
    </PageShell>
  );
}
