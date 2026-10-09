"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Shield,
  Wrench,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import Button from "@/components/ui/Button";
import {
  AGENT_PLATFORM_OPTIONS,
  BUILD_AGENT_COPY,
  getAgentPlatformOption,
  type AgentPlatformId,
  type ConnectSupportStatus,
} from "@/lib/onboarding/connect-protect-options";
import {
  AGENT_CAPABILITY_OPTIONS,
  buildUnsureAgentProfile,
  canProceedFromCapabilities,
  canProceedFromDescribe,
  type AgentCapabilityId,
} from "@/lib/onboarding/unsure-agent-profile";

type FlowStep =
  | "intro"
  | "agent-type"
  | "unsure-describe"
  | "unsure-capabilities"
  | "unsure-summary"
  | "unsure-connection-options"
  | "result"
  | "build";

const DESCRIBE_EXAMPLE =
  "It answers customer questions and sends emails.";

const CONNECTION_PLATFORM_OPTIONS = AGENT_PLATFORM_OPTIONS.filter(
  (option) => option.id !== "unsure"
);

function statusLabel(status: ConnectSupportStatus): string {
  switch (status) {
    case "setup_required":
      return "Connection setup required";
    case "coming_soon":
      return "Coming soon";
    default:
      return "";
  }
}

function StatusBadge({ status }: { status: ConnectSupportStatus }) {
  if (status === "guide") {
    return null;
  }

  const label = statusLabel(status);
  const className =
    status === "coming_soon"
      ? "cp-status-badge cp-status-coming-soon"
      : "cp-status-badge cp-status-setup";

  return <span className={className}>{label}</span>;
}

export default function ConnectProtectPage() {
  const searchParams = useSearchParams();
  const initialBuild = searchParams.get("start") === "build";

  const [step, setStep] = useState<FlowStep>(initialBuild ? "build" : "intro");
  const [selectedPlatform, setSelectedPlatform] = useState<AgentPlatformId | null>(
    null
  );
  const [agentDescription, setAgentDescription] = useState("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<
    AgentCapabilityId[]
  >([]);
  const [resultReturnStep, setResultReturnStep] = useState<FlowStep>("agent-type");

  const selectedOption = useMemo(
    () => (selectedPlatform ? getAgentPlatformOption(selectedPlatform) : null),
    [selectedPlatform]
  );

  const unsureProfile = useMemo(
    () =>
      buildUnsureAgentProfile({
        description: agentDescription,
        capabilities: selectedCapabilities,
      }),
    [agentDescription, selectedCapabilities]
  );

  const goToAgentType = useCallback(() => {
    setStep("agent-type");
  }, []);

  const goToBuild = useCallback(() => {
    setStep("build");
  }, []);

  const goBack = useCallback(() => {
    switch (step) {
      case "unsure-connection-options":
        setStep("unsure-summary");
        break;
      case "unsure-summary":
        setStep("unsure-capabilities");
        break;
      case "unsure-capabilities":
        setStep("unsure-describe");
        break;
      case "unsure-describe":
        setStep("agent-type");
        break;
      case "result":
        setStep(resultReturnStep);
        break;
      case "agent-type":
      case "build":
        setStep("intro");
        break;
      default:
        break;
    }
  }, [resultReturnStep, step]);

  const selectPlatform = useCallback(
    (id: AgentPlatformId, returnStep: FlowStep = "agent-type") => {
      setSelectedPlatform(id);
      setResultReturnStep(returnStep);

      if (id === "unsure") {
        setStep("unsure-describe");
        return;
      }

      setStep("result");
    },
    []
  );

  const toggleCapability = useCallback((id: AgentCapabilityId) => {
    setSelectedCapabilities((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }, []);

  const showBackButton = step !== "intro";

  return (
    <PageShell maxWidth="4xl" className="cp-page">
      <div className="cp-flow">
        {showBackButton ? (
          <button type="button" onClick={goBack} className="cp-back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Back
          </button>
        ) : null}

        {step === "intro" ? (
          <section className="cp-hero fade-in-up" aria-labelledby="cp-intro-title">
            <div className="cp-hero-icon" aria-hidden="true">
              <Shield className="h-8 w-8 text-white" strokeWidth={2} />
            </div>
            <h1 id="cp-intro-title" className="cp-title">
              Connect your existing AI agent to Wave
            </h1>
            <p className="cp-lead">
              Keep using your current AI agent. Wave sits between your agent and important actions
              and checks them before execution.
            </p>

            <div className="cp-flow-diagram" aria-label="How Wave connects to your agent">
              <p className="cp-flow-node">Your AI agent</p>
              <p className="cp-flow-arrow-down" aria-hidden="true">
                ↓
              </p>
              <p className="cp-flow-node cp-flow-node-brand">Wave</p>
              <p className="cp-flow-arrow-down" aria-hidden="true">
                ↓
              </p>
              <p className="cp-flow-node">Policy check</p>
              <p className="cp-flow-arrow-down" aria-hidden="true">
                ↓
              </p>
              <p className="cp-flow-node">Risk check</p>
              <p className="cp-flow-arrow-down" aria-hidden="true">
                ↓
              </p>
              <p className="cp-flow-node">Human approval (if needed)</p>
              <p className="cp-flow-arrow-down" aria-hidden="true">
                ↓
              </p>
              <p className="cp-flow-node cp-flow-node-final">Execute / Block</p>
            </div>

            <h2 className="cp-subtitle">How do you want to connect your agent?</h2>

            <div className="cp-choice-stack">
              <Link href="/onboarding/connect/wizard" className="cp-choice-btn cp-choice-link">
                <span className="cp-choice-btn-icon">
                  <Link2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="cp-choice-btn-body">
                  <span className="cp-choice-btn-text">API / SDK</span>
                  <span className="cp-choice-btn-desc">
                    Connect an agent using Wave&apos;s API or SDK.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={2} />
              </Link>

              <button type="button" className="cp-choice-btn" onClick={goToAgentType}>
                <span className="cp-choice-btn-icon">
                  <Wrench className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="cp-choice-btn-body">
                  <span className="cp-choice-btn-text">Existing integration</span>
                  <span className="cp-choice-btn-desc">
                    Connect an agent from a supported platform.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={2} />
              </button>

              <Link href="/test-action" className="cp-choice-btn cp-choice-link">
                <span className="cp-choice-btn-icon cp-choice-btn-icon-secondary">
                  <Bot className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="cp-choice-btn-body">
                  <span className="cp-choice-btn-text">Test with demo agent</span>
                  <span className="cp-choice-btn-desc">
                    Try Wave without connecting a real system.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={2} />
              </Link>
            </div>

            <p className="cp-intro-alt">
              Prefer to build from scratch?{" "}
              <button type="button" className="fd-link" onClick={goToBuild}>
                Create a new agent with Wave
              </button>
            </p>
          </section>
        ) : null}

        {step === "agent-type" ? (
          <section className="fade-in-up" aria-labelledby="cp-agent-type-title">
            <h1 id="cp-agent-type-title" className="cp-title">
              What kind of agent do you have?
            </h1>
            <p className="cp-lead cp-lead-compact">
              Pick the closest match. This helps us show you the right next steps.
            </p>

            <ul className="cp-platform-grid">
              {AGENT_PLATFORM_OPTIONS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="cp-platform-card"
                    onClick={() => selectPlatform(option.id)}
                  >
                    <span className="cp-platform-number">{option.number}</span>
                    <span className="cp-platform-body">
                      <span className="cp-platform-title-row">
                        <span className="cp-platform-title">{option.title}</span>
                        {option.id !== "unsure" ? (
                          <StatusBadge status={option.status} />
                        ) : null}
                      </span>
                      <span className="cp-platform-desc">{option.description}</span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-zinc-600"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {step === "unsure-describe" ? (
          <section className="fade-in-up" aria-labelledby="cp-unsure-describe-title">
            <h1 id="cp-unsure-describe-title" className="cp-title">
              No problem. Tell us what your AI agent does.
            </h1>
            <p className="cp-lead cp-lead-compact">
              Use everyday language — no technical terms needed.
            </p>

            <label className="cp-field">
              <span className="sr-only">What your agent does</span>
              <textarea
                className="cp-textarea"
                rows={5}
                value={agentDescription}
                onChange={(event) => setAgentDescription(event.target.value)}
                placeholder={`Example: ${DESCRIBE_EXAMPLE}`}
              />
            </label>

            <div className="cp-result-actions">
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={!canProceedFromDescribe(agentDescription)}
                onClick={() => setStep("unsure-capabilities")}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === "unsure-capabilities" ? (
          <section className="fade-in-up" aria-labelledby="cp-unsure-capabilities-title">
            <h1 id="cp-unsure-capabilities-title" className="cp-title">
              What can your agent do?
            </h1>
            <p className="cp-lead cp-lead-compact">
              Select everything that applies. This helps us understand what to protect.
            </p>

            <ul className="cp-capability-grid">
              {AGENT_CAPABILITY_OPTIONS.map((option) => {
                const selected = selectedCapabilities.includes(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={`cp-capability-option ${selected ? "cp-capability-option-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => toggleCapability(option.id)}
                    >
                      <span
                        className={`cp-capability-check ${selected ? "cp-capability-check-selected" : ""}`}
                        aria-hidden="true"
                      >
                        {selected ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="cp-result-actions">
              <Button
                variant="primary"
                icon={ArrowRight}
                disabled={
                  !canProceedFromCapabilities(agentDescription, selectedCapabilities)
                }
                onClick={() => setStep("unsure-summary")}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === "unsure-summary" ? (
          <section className="fade-in-up" aria-labelledby="cp-unsure-summary-title">
            <span className="cp-status-badge cp-status-not-connected">Not connected yet</span>

            <h1 id="cp-unsure-summary-title" className="cp-title cp-title-result">
              Thanks. We understand the type of agent you&apos;re using.
            </h1>

            <article className="cp-summary-card">
              <h2 className="cp-summary-title">{unsureProfile.title}</h2>
              <p className="cp-summary-body">&ldquo;{unsureProfile.summary}&rdquo;</p>
            </article>

            <p className="cp-lead">
              To protect the agent, it needs to send its actions through Wave.
            </p>
            <p className="cp-detail">
              Nothing is connected yet. The next step is choosing how your agent will
              link to Wave — we&apos;ll guide you from there.
            </p>

            <div className="cp-result-actions">
              <Button
                variant="primary"
                icon={ArrowRight}
                onClick={() => setStep("unsure-connection-options")}
              >
                See connection options
              </Button>
            </div>

            <details className="cp-advanced-setup">
              <summary className="cp-advanced-setup-summary">
                Advanced setup
                <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </summary>
              <div className="cp-advanced-setup-body">
                <p>
                  For developers: create an API key and add Wave to your agent code on
                  the My Agents page.
                </p>
                <Link href="/integrations" className="fd-link">
                  Open advanced setup
                </Link>
              </div>
            </details>
          </section>
        ) : null}

        {step === "unsure-connection-options" ? (
          <section className="fade-in-up" aria-labelledby="cp-connection-options-title">
            <h1 id="cp-connection-options-title" className="cp-title">
              How is your agent built?
            </h1>
            <p className="cp-lead cp-lead-compact">
              Pick the closest option. Your agent is not connected until setup is
              complete on the next screens.
            </p>

            <ul className="cp-platform-grid">
              {CONNECTION_PLATFORM_OPTIONS.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="cp-platform-card"
                    onClick={() => selectPlatform(option.id, "unsure-connection-options")}
                  >
                    <span className="cp-platform-number">{option.number}</span>
                    <span className="cp-platform-body">
                      <span className="cp-platform-title-row">
                        <span className="cp-platform-title">{option.title}</span>
                        <StatusBadge status={option.status} />
                      </span>
                      <span className="cp-platform-desc">{option.description}</span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-zinc-600"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {step === "result" && selectedOption ? (
          <section className="fade-in-up" aria-labelledby="cp-result-title">
            <span className="cp-status-badge cp-status-not-connected">Not connected yet</span>

            {selectedOption.status !== "guide" ? (
              <StatusBadge status={selectedOption.status} />
            ) : null}

            <h1 id="cp-result-title" className="cp-title cp-title-result">
              {selectedOption.resultTitle}
            </h1>
            <p className="cp-lead">{selectedOption.resultBody}</p>
            {selectedOption.resultDetail ? (
              <p className="cp-detail">{selectedOption.resultDetail}</p>
            ) : null}

            {selectedOption.status === "coming_soon" ? (
              <div className="cp-result-actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setStep(
                      resultReturnStep === "unsure-connection-options"
                        ? "unsure-connection-options"
                        : "agent-type"
                    )
                  }
                >
                  Choose a different type
                </Button>
                <Button
                  variant="primary"
                  icon={ArrowRight}
                  onClick={() => selectPlatform("custom", resultReturnStep)}
                >
                  Connect a custom agent instead
                </Button>
              </div>
            ) : null}

            {selectedOption.status === "setup_required" && selectedOption.ctaHref ? (
              <div className="cp-result-actions">
                <Link
                  href={selectedOption.ctaHref}
                  className="ds-btn ds-btn-primary inline-flex items-center gap-2"
                >
                  {selectedOption.ctaLabel ?? "Continue"}
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                </Link>
                <p className="cp-result-note">
                  <Wrench className="inline h-3.5 w-3.5 -translate-y-px" strokeWidth={2} />
                  {" "}
                  Your agent is not connected until setup is finished on the next page.
                </p>
              </div>
            ) : null}

            <details className="cp-advanced-setup">
              <summary className="cp-advanced-setup-summary">
                Advanced setup
                <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </summary>
              <div className="cp-advanced-setup-body">
                <p>
                  API keys, code examples, and developer documentation live on the My
                  Agents page.
                </p>
                <Link href="/integrations" className="fd-link">
                  Open advanced setup
                </Link>
              </div>
            </details>
          </section>
        ) : null}

        {step === "build" ? (
          <section className="fade-in-up" aria-labelledby="cp-build-title">
            <h1 id="cp-build-title" className="cp-title cp-title-result">
              {BUILD_AGENT_COPY.title}
            </h1>
            <p className="cp-lead">{BUILD_AGENT_COPY.body}</p>
            <p className="cp-detail">{BUILD_AGENT_COPY.detail}</p>

            <div className="cp-result-actions">
              <Link
                href={BUILD_AGENT_COPY.ctaHref}
                className="ds-btn ds-btn-primary inline-flex items-center gap-2"
              >
                {BUILD_AGENT_COPY.ctaLabel}
                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              </Link>
              <Button variant="ghost" onClick={goToAgentType}>
                I already have an agent
              </Button>
            </div>
          </section>
        ) : null}

        {step === "intro" ? (
          <p className="cp-footer-link">
            <Link href="/dashboard" className="fd-link">
              Back to Overview
            </Link>
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}
