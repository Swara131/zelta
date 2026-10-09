"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import type { AgentBuildView } from "@/lib/agent-builder/build-response";
import { saveCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { saveAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import { saveAgentConfigFromCreate } from "@/lib/agents/load-agent-setup-config";
import {
  BUILDER_GOOD_LENGTH_CHARS,
  BUILDER_MAX_CHARS,
  BUILDER_MIN_PARSE_CHARS,
  BUILDER_PREVIEW_BULLETS,
  BUILDER_TEMPLATE_PROMPTS,
  BUILDER_TRUST_BADGES,
} from "@/lib/agent-builder/builder-templates";
import {
  formatTriggerDisplay,
  normalizeAgentBuildForCreate,
  validateAgentBuildView,
} from "@/lib/agent-builder/validate-agent-build";
import { buildCreateAgentPayload } from "@/lib/agents/build-create-payload";
import { createStandaloneLifecyclePatch } from "@/lib/agents/agent-mode";
import type { AgentSpec } from "@/lib/agent-builder/types";

export const AGENT_CREATED_TOAST_KEY = "zelta:agent-created-toast";

type BuilderStep = "describe" | "loading" | "preview" | "created";

interface AgentBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (agentId: string) => void;
}

const PLACEHOLDER =
  "e.g., Email customers their refund status and issue refunds under ₹5,000";

const LOADING_MIN_MS = 2_400;
const CREATE_TIMEOUT_MS = 10_000;
const SUCCESS_REDIRECT_DELAY_MS = 1_000;

async function fetchCreateAgent(
  createPayload: ReturnType<typeof buildCreateAgentPayload>
): Promise<{
  agentId: string;
  spec: AgentBuildView["spec"];
  plainKey: string;
  keyPrefix: string;
}> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);

  try {
    const response = await fetch("/api/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      success?: boolean;
      agentId?: string;
      spec?: AgentBuildView["spec"];
      plainKey?: string;
      key?: { keyPrefix?: string; agentId?: string };
      error?: string;
    };

    if (!response.ok || payload.success === false) {
      throw new Error(payload.error ?? "Failed to create agent.");
    }

    const agentId = payload.agentId ?? payload.key?.agentId;
    if (!agentId || !payload.plainKey || !payload.spec) {
      throw new Error("Incomplete response from agent creation.");
    }

    return {
      agentId,
      spec: payload.spec,
      plainKey: payload.plainKey,
      keyPrefix: payload.key?.keyPrefix ?? "",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out after 10 seconds. Please try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatPolicySummary(spec: AgentSpec): string {
  const reviewRule = spec.protection.find((rule) => rule.level === "review");
  if (reviewRule) return reviewRule.label;
  const allowRule = spec.protection.find((rule) => rule.level === "allow");
  if (allowRule) return `${allowRule.label} — larger actions need approval`;
  return "Important actions pause for human approval";
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 18 }, (_, index) => index);

  return (
    <div className="abm-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece} className={`abm-confetti-piece abm-confetti-piece-${piece % 6}`} />
      ))}
    </div>
  );
}

function PreviewPanel({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <aside className="abm-preview-panel">
      <h3 className="abm-preview-title">What Wave will do</h3>
      <p className="abm-preview-lead">Your agent will:</p>
      <ul className="abm-preview-list">
        {BUILDER_PREVIEW_BULLETS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <ul className="abm-trust-badges">
        {BUILDER_TRUST_BADGES.map((badge) => (
          <li key={badge}>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
            {badge}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function AgentBuilderModal({
  open,
  onClose,
  onCreated,
}: AgentBuilderModalProps) {
  const [step, setStep] = useState<BuilderStep>("describe");
  const [sentence, setSentence] = useState("");
  const [build, setBuild] = useState<AgentBuildView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);

  const charCount = sentence.length;
  const trimmedLength = sentence.trim().length;

  const charStatus = useMemo(() => {
    if (trimmedLength < BUILDER_MIN_PARSE_CHARS) return "short";
    if (trimmedLength >= BUILDER_GOOD_LENGTH_CHARS) return "good";
    return "neutral";
  }, [trimmedLength]);

  const buildValidation = useMemo(
    () => (build ? validateAgentBuildView(build) : null),
    [build]
  );

  const canCreate = buildValidation?.valid ?? false;

  const canParse = trimmedLength >= BUILDER_MIN_PARSE_CHARS;

  const reset = useCallback(() => {
    setStep("describe");
    setSentence("");
    setBuild(null);
    setError(null);
    setCreateError(null);
    setCreating(false);
    setCreatedAgentId(null);
    setLoadingPhase(0);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating && step !== "loading" && step !== "created") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, creating, step]);

  useEffect(() => {
    if (step !== "created" || !createdAgentId) return;

    const timer = window.setTimeout(() => {
      onCreated?.(createdAgentId);
      onClose();
      window.location.href = `/agents/${encodeURIComponent(createdAgentId)}/ready`;
    }, SUCCESS_REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [step, createdAgentId, onClose, onCreated]);

  useEffect(() => {
    if (step !== "loading") return;

    setLoadingPhase(0);
    const timer = window.setTimeout(() => setLoadingPhase(1), 900);
    return () => window.clearTimeout(timer);
  }, [step]);

  const handleParse = async () => {
    if (!canParse) return;

    setStep("loading");
    setError(null);
    setBuild(null);

    try {
      const [response] = await Promise.all([
        fetch("/api/v1/agents/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentence: sentence.trim() }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, LOADING_MIN_MS)),
      ]);

      const payload = (await response.json()) as
        | (AgentBuildView & { success?: true })
        | { success: false; error: string };

      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.success === false
            ? payload.error
            : "Failed to parse your description."
        );
      }

      if (!("spec" in payload) || !payload.spec) {
        throw new Error("Incomplete response from agent builder.");
      }

      setBuild(payload);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse your description.");
      setStep("describe");
    }
  };

  const handleCreate = async () => {
    if (!build || !canCreate || creating) return;

    const normalizedBuild = normalizeAgentBuildForCreate(build);
    const createPayload = buildCreateAgentPayload(normalizedBuild);

    setCreating(true);
    setCreateError(null);
    setError(null);

    try {
      const result = await fetchCreateAgent(createPayload);

      saveCreatedAgentSession({
        spec: result.spec,
        plainKey: result.plainKey,
        keyPrefix: result.keyPrefix,
        agentId: result.agentId,
        createdAt: new Date().toISOString(),
      });

      saveAgentConfigFromCreate({
        agentId: result.agentId,
        name: result.spec.name,
        description: result.spec.summary || result.spec.purpose,
        purpose: result.spec.purpose || result.spec.summary,
        triggerType: createPayload.triggerType,
        tools: createPayload.tools,
        suggestedThreshold: createPayload.suggestedThreshold ?? null,
      });

      saveAgentLifecycle(result.agentId, createStandaloneLifecyclePatch());

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          AGENT_CREATED_TOAST_KEY,
          "✓ Agent created successfully"
        );
      }

      setCreatedAgentId(result.agentId);
      setStep("created");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create agent.";
      setCreateError(`Failed to create agent: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSentenceChange = (value: string) => {
    setSentence(value.slice(0, BUILDER_MAX_CHARS));
    setError(null);
  };

  if (!open) return null;

  return (
    <div className="abm-overlay">
      <button
        type="button"
        className="abm-backdrop"
        aria-label="Close builder"
        onClick={creating || step === "loading" || step === "created" ? undefined : onClose}
      />

      <div
        className={`abm-shell ${step === "preview" || step === "created" ? "abm-shell-success" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="abm-title"
      >
        {step === "preview" || step === "created" ? <ConfettiBurst /> : null}

        <header className="abm-header">
          <div className="abm-header-copy">
            <h2 id="abm-title" className="abm-title">
              {step === "created"
                ? "✓ Agent created successfully"
                : step === "preview"
                  ? "✓ Agent ready!"
                  : "✨ Create your first agent"}
            </h2>
            {step === "describe" ? (
              <>
                <p className="abm-subtitle">
                  Describe what your agent should do in one sentence
                </p>
                <span className="abm-subtitle-line" aria-hidden="true" />
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="abm-close"
            onClick={onClose}
            disabled={creating || step === "loading" || step === "created"}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>

        {step === "describe" ? (
          <div className="abm-body abm-body-split">
            <div className="abm-main">
              <label className="abm-input-wrap">
                <span className="sr-only">Agent description</span>
                <textarea
                  className="abm-textarea"
                  value={sentence}
                  onChange={(event) => handleSentenceChange(event.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={6}
                  autoFocus
                />
              </label>

              <div className="abm-char-row">
                <span
                  className={`abm-char-count ${charStatus === "good" ? "abm-char-count-good" : ""}`}
                  aria-live="polite"
                >
                  {charCount} / {BUILDER_MAX_CHARS} characters
                </span>
                {charStatus === "good" ? (
                  <span className="abm-char-status abm-char-status-good">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Good length
                  </span>
                ) : null}
                {charStatus === "short" && trimmedLength > 0 ? (
                  <span className="abm-char-status abm-char-status-short">
                    <XCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Add a bit more detail
                  </span>
                ) : null}
              </div>

              <div className="abm-templates">
                <p className="abm-templates-label">Quick templates</p>
                <div className="abm-template-grid">
                  {BUILDER_TEMPLATE_PROMPTS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="abm-template-btn"
                      onClick={() => handleSentenceChange(template.sentence)}
                    >
                      <span className="abm-template-emoji" aria-hidden="true">
                        {template.emoji}
                      </span>
                      <span className="abm-template-body">
                        <span className="abm-template-name">{template.label}</span>
                        <span className="abm-template-desc">{template.sentence}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <p className="abm-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="abm-footer-actions">
                <button type="button" className="abm-btn-cancel" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="abm-btn-parse"
                  disabled={!canParse}
                  onClick={() => void handleParse()}
                >
                  ✨ Parse &amp; Generate
                </button>
              </div>
            </div>

            <PreviewPanel visible />
          </div>
        ) : null}

        {step === "loading" ? (
          <div className="abm-body abm-body-loading" aria-live="polite">
            <div className="abm-loading-card">
              <Loader2 className="abm-loading-spinner" strokeWidth={2} aria-hidden="true" />
              <p className="abm-loading-title">Analyzing your description...</p>
              <p className={`abm-loading-sub ${loadingPhase === 1 ? "abm-loading-sub-visible" : ""}`}>
                Matching tools, generating policy, setting up protection...
              </p>
            </div>
          </div>
        ) : null}

        {step === "preview" && build && buildValidation ? (
          <div className="abm-body abm-body-success">
            <div className="abm-success-card">
              <dl className="abm-spec-grid">
                <div className={`abm-spec-field ${buildValidation.fieldErrors.name ? "abm-spec-field-invalid" : ""}`}>
                  <dt>Agent name</dt>
                  <dd>{build.spec.name}</dd>
                  {buildValidation.fieldErrors.name ? (
                    <p className="abm-field-error">{buildValidation.fieldErrors.name}</p>
                  ) : null}
                </div>
                <div className={`abm-spec-field ${buildValidation.fieldErrors.tools ? "abm-spec-field-invalid" : ""}`}>
                  <dt>Tools</dt>
                  <dd>
                    <ul className="abm-tool-pills">
                      {build.spec.tools.map((tool) => (
                        <li key={tool.id}>
                          <span className="abm-tool-pill">{tool.toolName}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                  {buildValidation.fieldErrors.tools ? (
                    <p className="abm-field-error">{buildValidation.fieldErrors.tools}</p>
                  ) : null}
                </div>
                <div className={`abm-spec-field ${buildValidation.fieldErrors.triggerType ? "abm-spec-field-invalid" : ""}`}>
                  <dt>Trigger</dt>
                  <dd>
                    {buildValidation.normalizedTrigger
                      ? formatTriggerDisplay(buildValidation.normalizedTrigger)
                      : (build.triggerType ?? "—")}
                  </dd>
                  {buildValidation.fieldErrors.triggerType ? (
                    <p className="abm-field-error">{buildValidation.fieldErrors.triggerType}</p>
                  ) : null}
                </div>
                <div className={`abm-spec-field ${buildValidation.fieldErrors.suggestedThreshold ? "abm-spec-field-invalid" : ""}`}>
                  <dt>Policy</dt>
                  <dd>{formatPolicySummary(build.spec)}</dd>
                  {buildValidation.fieldErrors.suggestedThreshold ? (
                    <p className="abm-field-error">{buildValidation.fieldErrors.suggestedThreshold}</p>
                  ) : null}
                </div>
              </dl>

              {!canCreate ? (
                <p className="abm-validation-banner" role="alert">
                  Fix validation errors above
                </p>
              ) : (
                <p className="abm-validation-ok" role="status">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                  All fields validated — ready to create
                </p>
              )}

              {createError ? (
                <div className="abm-create-toast abm-create-toast-error" role="alert">
                  <XCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <div className="abm-create-toast-body">
                    <p>{createError}</p>
                    <div className="abm-create-toast-actions">
                      <button
                        type="button"
                        className="abm-btn-back abm-create-retry"
                        disabled={creating}
                        onClick={() => void handleCreate()}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="abm-btn-back"
                        disabled={creating}
                        onClick={() => {
                          setCreateError(null);
                          setStep("describe");
                          setBuild(null);
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        Back to edit
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="abm-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="abm-footer-actions abm-footer-actions-success">
                {!createError ? (
                  <>
                    <button
                      type="button"
                      className="abm-btn-back"
                      disabled={creating}
                      onClick={() => {
                        setStep("describe");
                        setBuild(null);
                        setError(null);
                        setCreateError(null);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      Back to edit
                    </button>
                    <button
                      type="button"
                      className="abm-btn-create"
                      disabled={creating || !canCreate}
                      onClick={() => void handleCreate()}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Creating agent...
                        </>
                      ) : (
                        <>
                          Create agent
                          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </>
                ) : creating ? (
                  <button type="button" className="abm-btn-create" disabled>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating agent...
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="abm-body abm-body-created" aria-live="polite">
            <div className="abm-created-card">
              <CheckCircle2 className="abm-created-icon" strokeWidth={2} aria-hidden="true" />
              <p className="abm-created-title">✓ Agent created successfully</p>
              <p className="abm-created-desc">
                Redirecting to your agent setup…
              </p>
              <Loader2 className="abm-loading-spinner abm-created-spinner" strokeWidth={2} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AgentCreatedToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(AGENT_CREATED_TOAST_KEY);
    if (stored) {
      setMessage(stored);
      sessionStorage.removeItem(AGENT_CREATED_TOAST_KEY);
      const timer = window.setTimeout(() => setMessage(null), 4000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!message) return null;

  return (
    <div className="ds-toast abm-toast" role="status">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} aria-hidden="true" />
      {message}
    </div>
  );
}
