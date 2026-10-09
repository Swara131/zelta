"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import DecisionAgentPreviewCard from "@/components/decision-agents/DecisionAgentPreviewCard";
import DecisionAgentInlineTest from "@/components/decision-agents/DecisionAgentInlineTest";
import { DECISION_AGENT_TEMPLATES, type GeneratedDecisionAgentPreview } from "@/lib/decision-agents/types";

export default function CreateDecisionAgentPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const template = DECISION_AGENT_TEMPLATES.find((item) => item.id === templateId);

  const [prompt, setPrompt] = useState(template?.purpose ?? "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedDecisionAgentPreview | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Describe what decision this agent should make.");
      return;
    }
    setGenerating(true);
    setError(null);
    setSaveError(null);
    setDeployMessage(null);
    setSavedSlug(null);
    setShowTest(false);

    try {
      const response = await fetch("/api/v1/decision-agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          templateId: template?.id,
          decisionType: template?.decisionType,
          name: template?.name,
        }),
      });
      const payload = (await response.json()) as {
        preview?: GeneratedDecisionAgentPreview;
        error?: string;
      };
      if (!response.ok || !payload.preview) {
        throw new Error(payload.error ?? "Could not generate decision agent.");
      }
      setPreview(payload.preview);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate decision agent.");
      setPreview(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/v1/decision-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preview.name,
          purpose: preview.purpose,
          decisionType: preview.decisionType,
          config: preview.config,
        }),
      });
      const payload = (await response.json()) as {
        agent?: { slug: string };
        error?: string;
      };
      if (!response.ok || !payload.agent) {
        throw new Error(payload.error ?? "Could not save decision agent. Please try again.");
      }
      setSavedSlug(payload.agent.slug);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save decision agent. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!savedSlug) {
      setSaveError("Save the agent before deploying.");
      return;
    }
    setDeploying(true);
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/v1/decision-agents/${encodeURIComponent(savedSlug)}/deploy`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Deployment failed.");
      }
      setDeployMessage(payload.message ?? "Decision agent deployed successfully.");
      if (preview) {
        setPreview({ ...preview, status: "deployed" });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Deployment failed.");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <PageShell maxWidth="5xl" className="zdec-page">
      <Link href="/decision-agents" className="zplat-btn zplat-btn-ghost">
        ← Multiple Decision Agents
      </Link>

      <header className="zdec-header">
        <div>
          <h1>Multiple Decision Agents</h1>
          <p className="zdec-lead">
            Create AI agents that make decisions based on your rules, context, and risk policies.
          </p>
        </div>
      </header>

      {!preview || editing ? (
        <section className="ds-panel zdec-create-form">
          <label className="zplat-field">
            <span>Describe what decision this agent should make</span>
            <textarea
              className="ds-input zdec-prompt"
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Decide whether a customer refund should be automatically approved."
            />
          </label>
          {error ? <p className="zplat-error" role="alert">{error}</p> : null}
          <button
            type="button"
            className="zplat-btn zplat-btn-primary"
            disabled={generating || !prompt.trim()}
            onClick={() => void handleGenerate()}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating decision agent…
              </>
            ) : (
              "Generate Decision Agent"
            )}
          </button>
        </section>
      ) : null}

      {preview && !editing ? (
        <>
          <DecisionAgentPreviewCard
            preview={preview}
            savedSlug={savedSlug}
            saving={saving}
            deploying={deploying}
            deployMessage={deployMessage}
            saveError={saveError}
            onTest={() => setShowTest(true)}
            onDeploy={() => void handleDeploy()}
            onEdit={() => setEditing(true)}
            onSave={() => void handleSave()}
          />
          {showTest ? (
            <DecisionAgentInlineTest
              config={preview.config}
              slug={savedSlug}
              onClose={() => setShowTest(false)}
            />
          ) : null}
          {savedSlug ? (
            <p className="zdec-post-save">
              Agent saved.{" "}
              <Link href="/decision-agents">View all agents</Link> or create another below.
            </p>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
