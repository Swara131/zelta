"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import type {
  OnboardingFirstBuild,
  OnboardingFamiliarity,
  OnboardingGoal,
  OnboardingRole,
  ZeltaOnboardingResponses,
} from "@/lib/onboarding/zelta-onboarding-types";

type Step = 1 | 2 | 3 | 4 | "complete";

const STEPS: Step[] = [1, 2, 3, 4];

interface Option<T extends string> {
  id: T;
  label: string;
}

const ROLE_OPTIONS: Option<OnboardingRole>[] = [
  { id: "founder", label: "Founder" },
  { id: "small_business", label: "Small business owner" },
  { id: "developer", label: "Developer" },
  { id: "marketer", label: "Marketer" },
  { id: "student", label: "Student" },
  { id: "freelancer", label: "Freelancer" },
  { id: "other", label: "Other" },
];

const GOAL_OPTIONS: Option<OnboardingGoal>[] = [
  { id: "create_agents", label: "Create AI agents" },
  { id: "automate_work", label: "Automate repetitive work" },
  { id: "monitor_agents", label: "Monitor and control AI agents" },
  { id: "both", label: "Both create and protect agents" },
  { id: "exploring", label: "I'm just exploring" },
];

const FAMILIARITY_OPTIONS: Option<OnboardingFamiliarity>[] = [
  { id: "new", label: "I'm completely new" },
  { id: "used_ai", label: "I've used AI tools" },
  { id: "simple_automations", label: "I've built simple automations" },
  { id: "built_agents", label: "I've built AI agents" },
  { id: "experienced_developer", label: "I'm an experienced developer" },
];

const FIRST_BUILD_OPTIONS: Option<OnboardingFirstBuild>[] = [
  { id: "marketing", label: "Marketing agent" },
  { id: "sales", label: "Sales agent" },
  { id: "research", label: "Research agent" },
  { id: "support", label: "Customer support agent" },
  { id: "social", label: "Social media agent" },
  { id: "data", label: "Data/analysis agent" },
  { id: "custom", label: "Something else" },
];

function stepTitle(step: Step): string {
  switch (step) {
    case 1:
      return "Welcome to Wave";
    case 2:
      return "What do you want to use Wave for?";
    case 3:
      return "How familiar are you with AI agents?";
    case 4:
      return "What would you like to build first?";
    case "complete":
      return "You're all set.";
  }
}

function stepSubtitle(step: Step): string {
  switch (step) {
    case 1:
      return "Let's set up your workspace so we can personalize your experience.";
    case 2:
    case 3:
    case 4:
      return "Choose the option that fits you best.";
    case "complete":
      return "Wave is ready to build your first agent.";
  }
}

export default function ZeltaWelcomeOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [responses, setResponses] = useState<ZeltaOnboardingResponses>({});
  const [customIdea, setCustomIdea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (step === "complete") return 100;
    return Math.round((STEPS.indexOf(step) / STEPS.length) * 100);
  }, [step]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(responses.role);
    if (step === 2) return Boolean(responses.goal);
    if (step === 3) return Boolean(responses.familiarity);
    if (step === 4) {
      if (responses.firstBuild === "custom") {
        return customIdea.trim().length >= 3;
      }
      return Boolean(responses.firstBuild);
    }
    return false;
  }, [step, responses, customIdea]);

  const persist = async (complete: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const payload: ZeltaOnboardingResponses = {
        ...responses,
        ...(responses.firstBuild === "custom"
          ? { customIdea: customIdea.trim() }
          : {}),
      };

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: payload, complete }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not save your answers.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    if (!canContinue || saving) return;

    if (step === 4) {
      try {
        await persist(true);
        router.refresh();
        setStep("complete");
      } catch {
        /* error shown */
      }
      return;
    }

    const index = STEPS.indexOf(step as 1 | 2 | 3 | 4);
    setStep(STEPS[index + 1] ?? 4);
  };

  const renderOptions = <T extends string>(
    options: Option<T>[],
    selected: T | undefined,
    onSelect: (value: T) => void
  ) => (
    <ul className="zob-options">
      {options.map((option) => {
        const active = selected === option.id;
        return (
          <li key={option.id}>
            <button
              type="button"
              className={`zob-option ${active ? "zob-option-selected" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(option.id)}
            >
              {option.label}
              {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (step === "complete") {
    return (
      <div className="zob-page">
        <div className="zob-card">
          <div className="zob-progress">
            <div className="zob-progress-fill" style={{ width: "100%" }} />
          </div>
          <h1 className="zob-title">{stepTitle(step)}</h1>
          <p className="zob-subtitle">{stepSubtitle(step)}</p>
          <div className="zob-complete-actions">
            <Link href="/agents/create" className="ds-btn ds-btn-primary">
              Create my first agent
            </Link>
            <Link href="/dashboard" className="ds-btn ds-btn-secondary">
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zob-page">
      <div className="zob-card">
        <div className="zob-progress" aria-hidden="true">
          <div className="zob-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <p className="zob-step-label">Step {step} of 4</p>
        <h1 className="zob-title">{stepTitle(step)}</h1>
        <p className="zob-subtitle">{stepSubtitle(step)}</p>

        {step === 1 ? (
          <>
            <p className="zob-question">What best describes you?</p>
            {renderOptions(ROLE_OPTIONS, responses.role, (role) =>
              setResponses((current) => ({ ...current, role }))
            )}
          </>
        ) : null}

        {step === 2
          ? renderOptions(GOAL_OPTIONS, responses.goal, (goal) =>
              setResponses((current) => ({ ...current, goal }))
            )
          : null}

        {step === 3
          ? renderOptions(FAMILIARITY_OPTIONS, responses.familiarity, (familiarity) =>
              setResponses((current) => ({ ...current, familiarity }))
            )
          : null}

        {step === 4 ? (
          <>
            {renderOptions(FIRST_BUILD_OPTIONS, responses.firstBuild, (firstBuild) =>
              setResponses((current) => ({ ...current, firstBuild }))
            )}
            {responses.firstBuild === "custom" ? (
              <label className="zob-custom-idea">
                <span>Describe my own idea</span>
                <textarea
                  className="ds-input"
                  rows={3}
                  value={customIdea}
                  onChange={(event) => setCustomIdea(event.target.value)}
                  placeholder="Example: Find AI founder posts and write thoughtful replies"
                />
              </label>
            ) : null}
          </>
        ) : null}

        {error ? <p className="zob-error">{error}</p> : null}

        <div className="zob-actions">
          {step > 1 ? (
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              disabled={saving}
              onClick={() => setStep((STEPS[STEPS.indexOf(step as 1 | 2 | 3 | 4) - 1] ?? 1) as Step)}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={!canContinue || saving}
            onClick={() => void handleContinue()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
