"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ArrowRight, Bot, Play, RotateCcw, Shield, Sparkles } from "lucide-react";
import {
  demoDecisionClass,
  ZELTA_DEMO_ACTIONS,
  ZELTA_DEMO_AGENT_NAME,
  ZELTA_DEMO_DISCLAIMER,
  type DemoDecision,
  type ZeltaDemoAction,
} from "@/lib/dashboard/zelta-demo-scenario";

type DemoPhase = "idle" | "agent" | "checking" | "decision" | "result" | "complete";

const PHASE_MS: Record<Exclude<DemoPhase, "idle" | "complete">, number> = {
  agent: 1400,
  checking: 1600,
  decision: 1400,
  result: 2000,
};

const PHASE_ORDER: Exclude<DemoPhase, "idle" | "complete">[] = [
  "agent",
  "checking",
  "decision",
  "result",
];

function phaseLabel(phase: DemoPhase): string {
  switch (phase) {
    case "agent":
      return "Agent";
    case "checking":
      return "Wave checks action";
    case "decision":
      return "Decision";
    case "result":
      return "Action";
    default:
      return "";
  }
}

function runDemoActionPhases(
  index: number,
  schedule: (fn: () => void, ms: number) => void,
  setPhase: (phase: DemoPhase) => void,
  setRunning: (running: boolean) => void,
  setActionIndex: (nextIndex: number) => void,
  setCompletedIds: Dispatch<SetStateAction<string[]>>
): void {
  if (index >= ZELTA_DEMO_ACTIONS.length) {
    setPhase("complete");
    setRunning(false);
    return;
  }

  setActionIndex(index);
  setPhase("agent");

  let elapsed = 0;
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const nextPhase = PHASE_ORDER[i + 1];
    const current = PHASE_ORDER[i]!;
    elapsed += PHASE_MS[current];

    if (nextPhase) {
      schedule(() => setPhase(nextPhase), elapsed);
    } else {
      schedule(() => {
        const action = ZELTA_DEMO_ACTIONS[index]!;
        setCompletedIds((prev) =>
          prev.includes(action.id) ? prev : [...prev, action.id]
        );
        runDemoActionPhases(
          index + 1,
          schedule,
          setPhase,
          setRunning,
          setActionIndex,
          setCompletedIds
        );
      }, elapsed);
    }
  }
}

interface ZeltaInActionDemoProps {
  /** Auto-start when the user has no connected agents yet */
  autoStart?: boolean;
  /** Nested inside Advanced panel — tighter layout */
  embedded?: boolean;
}

export default function ZeltaInActionDemo({
  autoStart = false,
  embedded = false,
}: ZeltaInActionDemoProps) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const timersRef = useRef<number[]>([]);
  const autoStartedRef = useRef(false);

  const currentAction: ZeltaDemoAction | null =
    actionIndex < ZELTA_DEMO_ACTIONS.length ? ZELTA_DEMO_ACTIONS[actionIndex]! : null;

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const resetDemo = useCallback(() => {
    clearTimers();
    setRunning(false);
    setActionIndex(0);
    setPhase("idle");
    setCompletedIds([]);
  }, [clearTimers]);

  const startDemo = useCallback(() => {
    clearTimers();
    setExpanded(true);
    setRunning(true);
    setActionIndex(0);
    setPhase("agent");
    setCompletedIds([]);
    runDemoActionPhases(
      0,
      schedule,
      setPhase,
      setRunning,
      setActionIndex,
      setCompletedIds
    );
  }, [clearTimers, schedule]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    const id = window.setTimeout(() => {
      setExpanded(true);
      startDemo();
    }, 800);
    return () => window.clearTimeout(id);
  }, [autoStart, startDemo]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const activePhase = running || phase === "complete" ? phase : "idle";

  return (
    <section
      className={`${embedded ? "fd-demo-embedded" : "fd-section"} fd-demo-section`}
      aria-labelledby="zelta-demo-heading"
      id="see-zelta-in-action"
    >
      <div className="fd-demo-header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles
              className="h-5 w-5 shrink-0 text-[#c4b5fd]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <h2 id="zelta-demo-heading" className="fd-section-title">
              See Wave in Action
            </h2>
            <span className="fd-demo-mode-badge">Demo Mode — simulated actions</span>
          </div>
          <p className="fd-demo-disclaimer mt-2">{ZELTA_DEMO_DISCLAIMER}</p>
          <p className="fd-section-desc mt-1">
            Watch how Wave protects a sample agent — no real systems connected.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!running && phase !== "complete" ? (
            <button type="button" className="ds-btn ds-btn-primary" onClick={startDemo}>
              <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {expanded ? "Watch demo" : "See Wave in Action"}
            </button>
          ) : phase === "complete" ? (
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                resetDemo();
                startDemo();
              }}
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Replay demo
            </button>
          ) : (
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                resetDemo();
              }}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {expanded ? (
        <div className="fd-demo-body">
          <p className="fd-demo-agent-label">
            <span className="fd-demo-data-tag">DEMO DATA</span>
            {ZELTA_DEMO_AGENT_NAME}
          </p>

          <div
            className="fd-demo-stage"
            role="region"
            aria-live="polite"
            aria-label="Simulated protection flow"
          >
            <DemoStageStep
              title="Agent"
              active={activePhase === "agent"}
              done={
                activePhase !== "idle" &&
                activePhase !== "agent"
              }
              icon={<Bot className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
            >
              {currentAction && activePhase !== "idle" && activePhase !== "complete" ? (
                <>
                  <p className="fd-demo-stage-kicker">Wants to:</p>
                  <p className="fd-demo-stage-action">&ldquo;{currentAction.label}&rdquo;</p>
                </>
              ) : phase === "complete" ? (
                <p className="fd-demo-stage-muted">All demo actions reviewed</p>
              ) : (
                <p className="fd-demo-stage-muted">Press Watch demo to begin</p>
              )}
            </DemoStageStep>

            <ArrowRight className="fd-demo-stage-arrow" strokeWidth={2} aria-hidden="true" />

            <DemoStageStep
              title="Wave checks action"
              active={activePhase === "checking"}
              done={
                activePhase === "decision" ||
                activePhase === "result" ||
                activePhase === "complete"
              }
              icon={<Shield className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
              pulse={activePhase === "checking"}
            >
              {activePhase === "checking" ? (
                <p className="fd-demo-stage-checking">Checking your protection rules…</p>
              ) : activePhase === "decision" ||
                activePhase === "result" ||
                activePhase === "complete" ? (
                <p className="fd-demo-stage-muted">Rules checked</p>
              ) : (
                <p className="fd-demo-stage-muted">Watches every action</p>
              )}
            </DemoStageStep>

            <ArrowRight className="fd-demo-stage-arrow" strokeWidth={2} aria-hidden="true" />

            <DemoStageStep
              title="Decision"
              active={activePhase === "decision"}
              done={activePhase === "result" || activePhase === "complete"}
              icon={
                currentAction ? (
                  <span className="text-lg" aria-hidden="true">
                    {currentAction.decisionEmoji}
                  </span>
                ) : (
                  <span className="text-lg" aria-hidden="true">
                    •
                  </span>
                )
              }
              tone={
                activePhase === "decision" || activePhase === "result"
                  ? currentAction?.decision
                  : undefined
              }
            >
              {currentAction &&
              (activePhase === "decision" || activePhase === "result") ? (
                <p className="fd-demo-stage-decision">
                  {currentAction.decisionEmoji} {currentAction.decisionLabel}
                </p>
              ) : (
                <p className="fd-demo-stage-muted">Allow · Ask · Block</p>
              )}
            </DemoStageStep>

            <ArrowRight className="fd-demo-stage-arrow" strokeWidth={2} aria-hidden="true" />

            <DemoStageStep
              title="Action"
              active={activePhase === "result"}
              done={activePhase === "complete" || completedIds.includes(currentAction?.id ?? "")}
              icon={
                <span className="text-base font-bold text-[var(--ds-text-secondary)]">→</span>
              }
              tone={activePhase === "result" ? currentAction?.decision : undefined}
            >
              {currentAction && activePhase === "result" ? (
                <p className="fd-demo-stage-result">{currentAction.resultMessage}</p>
              ) : (
                <p className="fd-demo-stage-muted">What happens next</p>
              )}
            </DemoStageStep>
          </div>

          <ol className="fd-demo-action-list" aria-label="Demo action examples">
            {ZELTA_DEMO_ACTIONS.map((action, index) => {
              const isCurrent = running && actionIndex === index;
              const isDone = completedIds.includes(action.id);

              return (
                <li
                  key={action.id}
                  className={`fd-demo-action-item ${demoDecisionClass(action.decision)} ${
                    isCurrent ? "fd-demo-action-item-current" : ""
                  } ${isDone ? "fd-demo-action-item-done" : ""}`}
                >
                  <span className="fd-demo-data-tag fd-demo-data-tag-inline">DEMO</span>
                  <div className="min-w-0 flex-1">
                    <p className="fd-demo-action-label">{action.label}</p>
                    <p className="fd-demo-action-outcome">
                      → {action.decisionEmoji} {action.decisionLabel}
                    </p>
                  </div>
                  {isCurrent && running ? (
                    <span className="fd-demo-action-status" aria-hidden="true">
                      {phaseLabel(phase)}
                    </span>
                  ) : isDone ? (
                    <span className="fd-demo-action-status fd-demo-action-status-done">Done</span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {phase === "complete" ? (
            <p className="fd-demo-complete">
              That&apos;s Wave in ~30 seconds — safe actions run, risky ones ask you, dangerous
              ones never happen. Connect a real agent when you&apos;re ready.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DemoStageStep({
  title,
  active,
  done,
  pulse,
  tone,
  icon,
  children,
}: {
  title: string;
  active: boolean;
  done: boolean;
  pulse?: boolean;
  tone?: DemoDecision;
  icon: ReactNode;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "allowed"
      ? "fd-demo-step-allow"
      : tone === "approval_required"
        ? "fd-demo-step-ask"
        : tone === "blocked"
          ? "fd-demo-step-block"
          : "";

  return (
    <article
      className={`fd-demo-step ${active ? "fd-demo-step-active" : ""} ${
        done ? "fd-demo-step-done" : ""
      } ${toneClass} ${pulse ? "fd-demo-step-pulse" : ""}`}
    >
      <div className="fd-demo-step-icon">{icon}</div>
      <p className="fd-demo-step-title">{title}</p>
      <div className="fd-demo-step-body">{children}</div>
    </article>
  );
}
