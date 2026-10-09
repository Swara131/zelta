"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import AgentBuilderFlow from "@/components/agents/builder/AgentBuilderFlow";
import AgentBuildProgress from "@/components/agents/workspace/AgentBuildProgress";
import AgentContextPanel from "@/components/agents/workspace/AgentContextPanel";
import AgentPromptBar from "@/components/agents/workspace/AgentPromptBar";
import AgentWorkflowCanvas from "@/components/agents/workspace/AgentWorkflowCanvas";
import AgentWorkspaceLayout from "@/components/agents/workspace/AgentWorkspaceLayout";
import type { AgentInterpretation } from "@/lib/agents/builder-types";
import { buildWorkflowFromInterpretation } from "@/lib/agents/workflow-nodes";
import { readJsonResponse } from "@/lib/ux/fetch-json";
import { FLOW_ERRORS } from "@/lib/ux/flow-copy";

const BUILD_STEPS = [
  { id: "understand", label: "Understanding your goal" },
  { id: "plan", label: "Designing workflow" },
  { id: "capabilities", label: "Connecting required tools" },
  { id: "instructions", label: "Setting up instructions" },
  { id: "safety", label: "Applying safety" },
  { id: "prepare", label: "Getting it ready" },
] as const;

type Phase = "prompt" | "building" | "ready" | "configure";

export default function ZeltaCreateAgentExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("prompt");
  const [description, setDescription] = useState(
    () => searchParams.get("idea")?.trim() ?? ""
  );
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [agentDbId, setAgentDbId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [interpretation, setInterpretation] = useState<AgentInterpretation | null>(null);
  const [buildStepIndex, setBuildStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmed = description.trim();

  const runBuild = useCallback(async () => {
    if (trimmed.length < 15) return;
    setPhase("building");
    setBuildStepIndex(0);
    setError(null);
    setLoading(true);

    try {
      const interpretRes = await fetch("/api/v1/agents/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });
      const interpretPayload = await readJsonResponse<{
        interpretation?: AgentInterpretation;
        error?: string;
      }>(interpretRes);
      if (!interpretRes.ok || !interpretPayload.interpretation) {
        throw new Error(interpretPayload.error ?? FLOW_ERRORS.createAgent);
      }

      setBuildStepIndex(2);
      const next = interpretPayload.interpretation;
      setInterpretation(next);

      setBuildStepIndex(3);
      const saveRes = await fetch("/api/v1/agents/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: next.displayName,
          goal: next.goal,
          instructions: next.instructions,
          scheduleSummary: next.scheduleSummary,
          schedule: next.schedule,
          timezone: next.timezone,
          capabilityIds: next.capabilityIds,
          tools: next.tools,
          triggerType: next.triggerType,
          suggestedThreshold: next.suggestedThreshold,
          originalDescription: trimmed,
          status: "active",
          deliveryMode: next.deliveryMode,
        }),
      });
      const savePayload = await readJsonResponse<{
        agentDbId?: string;
        slug?: string;
        error?: string;
      }>(saveRes);
      if (!saveRes.ok || !savePayload.slug) {
        throw new Error(savePayload.error ?? "Could not save your agent.");
      }

      setAgentSlug(savePayload.slug);
      setAgentDbId(savePayload.agentDbId ?? null);
      setBuildStepIndex(5);
      await new Promise((resolve) => setTimeout(resolve, 400));
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("prompt");
    } finally {
      setLoading(false);
    }
  }, [trimmed]);

  useEffect(() => {
    if (phase !== "building") return;
    if (buildStepIndex >= BUILD_STEPS.length - 1) return;
    const timer = window.setTimeout(() => {
      setBuildStepIndex((index) => Math.min(index + 1, BUILD_STEPS.length - 1));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [phase, buildStepIndex]);

  const workflowNodes = useMemo(
    () => (interpretation ? buildWorkflowFromInterpretation(interpretation) : undefined),
    [interpretation]
  );

  const contextData = useMemo(() => {
    if (!interpretation) {
      return {
        statusLabel: phase === "building" ? "Building" : "Ready",
        statusTone: phase === "building" ? ("building" as const) : ("idle" as const),
      };
    }
    return {
      name: interpretation.displayName,
      statusLabel: phase === "ready" ? "Ready" : "Building",
      statusTone: phase === "ready" ? ("ready" as const) : ("building" as const),
      purpose: interpretation.goal,
      tools: interpretation.tools,
      schedule: interpretation.scheduleSummary,
      protected: true,
    };
  }, [interpretation, phase]);

  if (phase === "configure" && interpretation) {
    return <AgentBuilderFlow />;
  }

  const workspaceHeader = (
    <>
      <div className="zws-heading">
        <h2 className="zws-heading-title">Agent</h2>
        <p className={`zws-heading-status zws-status-${contextData.statusTone ?? "idle"}`}>
          <span className="zws-status-dot" aria-hidden="true" />
          {contextData.statusLabel}
        </p>
      </div>
    </>
  );

  if (phase === "ready" && interpretation) {
    return (
      <PageShell layout="workspace" className="zws-shell">
        <AgentWorkspaceLayout
          header={workspaceHeader}
          contextPanel={<AgentContextPanel data={contextData} />}
          canvas={<AgentWorkflowCanvas nodes={workflowNodes} />}
          sidePanel={
            <aside className="zws-ready-panel" aria-label="Next steps">
              <div className="zws-ready-icon" aria-hidden="true">
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <h3 className="zws-ready-title">Your agent is ready</h3>
              <p className="zws-ready-lead">{interpretation.goal}</p>

              {error ? (
                <p className="zws-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="zws-ready-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn-primary w-full"
                  disabled={!agentSlug}
                  onClick={() => {
                    if (!agentSlug) return;
                    router.push(`/agents/${encodeURIComponent(agentSlug)}/prepare`);
                  }}
                >
                  Test agent
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary w-full"
                  disabled={!agentDbId || publishing}
                  onClick={() => {
                    if (!agentDbId || publishing) return;
                    void (async () => {
                      setPublishing(true);
                      setError(null);
                      try {
                        const response = await fetch("/api/v1/agents/publish-draft", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agentDbId }),
                        });
                        const payload = (await response.json()) as {
                          slug?: string;
                          error?: string;
                        };
                        if (!response.ok || !payload.slug) {
                          throw new Error(payload.error ?? "Could not publish agent.");
                        }
                        router.push(`/agents/${encodeURIComponent(payload.slug)}`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not publish agent.");
                      } finally {
                        setPublishing(false);
                      }
                    })();
                  }}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Publishing…
                    </>
                  ) : (
                    "Open agent hub"
                  )}
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-ghost w-full"
                  onClick={() => setPhase("configure")}
                >
                  Edit configuration
                </button>
                <Link href="/dashboard" className="ds-btn ds-btn-ghost w-full">
                  Back to Home
                </Link>
              </div>
            </aside>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell layout="workspace" className="zws-shell">
      <AgentWorkspaceLayout
        header={workspaceHeader}
        contextPanel={<AgentContextPanel data={contextData} />}
        canvas={
          phase === "building" ? (
            <AgentBuildProgress steps={BUILD_STEPS} activeIndex={buildStepIndex} />
          ) : (
            <AgentWorkflowCanvas nodes={workflowNodes} />
          )
        }
        promptBar={
          phase === "prompt" ? (
            <AgentPromptBar
              value={description}
              onChange={setDescription}
              onSubmit={() => void runBuild()}
              loading={loading}
              disabled={phase !== "prompt"}
            />
          ) : undefined
        }
        overlay={
          error && phase === "prompt" ? (
            <p className="zws-error zws-error-floating" role="alert">
              {error}
            </p>
          ) : undefined
        }
      />
    </PageShell>
  );
}
