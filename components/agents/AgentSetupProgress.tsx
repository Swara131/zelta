"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import {
  loadAgentLifecycle,
  saveAgentLifecycle,
  type AgentLifecycleProgress,
} from "@/lib/agent-builder/agent-lifecycle";
import {
  getSetupProgressSteps,
  isAgentSetupLive,
  type SetupProgressStep,
} from "@/lib/agent-builder/setup-progress-steps";
import ConfigureProtectionStepModal from "@/components/agents/ConfigureProtectionStepModal";
import ConnectAgentStepModal from "@/components/agents/ConnectAgentStepModal";
import RunTestActionStepModal from "@/components/agents/RunTestActionStepModal";
import AgentNextStepBanner from "@/components/agents/AgentNextStepBanner";
import { showTrustToastByKey } from "@/lib/trust/dashboard-trust";

type ActiveModal = "protection" | "connect" | "test" | null;

interface AgentSetupProgressProps {
  agentId: string;
  agentName: string;
  apiKey: AgentApiKeyRecord | null;
  /** Bump to re-read lifecycle from storage */
  refreshKey?: number;
  onProgressChange?: () => void;
  showLiveBanner?: boolean;
}

function StepRow({
  step,
  onOpenModal,
}: {
  step: SetupProgressStep;
  onOpenModal: (modal: NonNullable<SetupProgressStep["modal"]>) => void;
}) {
  if (step.complete) {
    return (
      <li className="asp-step asp-step-done">
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span>{step.label}</span>
      </li>
    );
  }

  if (step.modal) {
    return (
      <li className="asp-step asp-step-pending">
        <button
          type="button"
          className="asp-step-btn"
          onClick={() => onOpenModal(step.modal!)}
        >
          <span className="asp-step-circle" aria-hidden="true">
            ○
          </span>
          <span>{step.label}</span>
          <ArrowRight className="h-3.5 w-3.5 asp-step-arrow" strokeWidth={2} aria-hidden="true" />
        </button>
      </li>
    );
  }

  if (step.setupHref) {
    return (
      <li className="asp-step asp-step-pending">
        <Link href={step.setupHref} className="asp-step-btn">
          <span className="asp-step-circle" aria-hidden="true">
            ○
          </span>
          <span>{step.label}</span>
          <ArrowRight className="h-3.5 w-3.5 asp-step-arrow" strokeWidth={2} aria-hidden="true" />
        </Link>
      </li>
    );
  }

  return (
    <li className="asp-step asp-step-pending">
      <span className="asp-step-circle" aria-hidden="true">
        ○
      </span>
      <span>{step.label}</span>
    </li>
  );
}

export default function AgentSetupProgress({
  agentId,
  agentName,
  apiKey,
  refreshKey = 0,
  onProgressChange,
  showLiveBanner = true,
}: AgentSetupProgressProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [localVersion, setLocalVersion] = useState(0);

  const lifecycle = useMemo((): AgentLifecycleProgress => {
    void refreshKey;
    void localVersion;
    return loadAgentLifecycle(agentId);
  }, [agentId, refreshKey, localVersion]);

  const steps = useMemo(
    () => getSetupProgressSteps(agentId, lifecycle, apiKey),
    [agentId, lifecycle, apiKey]
  );

  const isLive = isAgentSetupLive(lifecycle, apiKey);

  const bump = () => {
    if (isAgentSetupLive(loadAgentLifecycle(agentId), apiKey) && !loadAgentLifecycle(agentId).activated) {
      saveAgentLifecycle(agentId, {
        activated: true,
        activatedAt: new Date().toISOString(),
      });
    }
    setLocalVersion((v) => v + 1);
    onProgressChange?.();
  };

  return (
    <>
      <div className="ma-agent-progress">
        <p className="ma-agent-progress-title">Setup progress</p>
        <ul className="asp-step-list">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onOpenModal={(modal) => setActiveModal(modal)}
            />
          ))}
        </ul>
      </div>

      <AgentNextStepBanner
        agentId={agentId}
        lifecycle={lifecycle}
        apiKey={apiKey}
        onOpenModal={(modal) => setActiveModal(modal)}
        className="ans-banner-in-card"
      />

      {showLiveBanner && isLive ? (
        <div className="asp-live-banner" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <div>
            <p className="asp-live-title">Agent is live</p>
            <p className="asp-live-desc">
              Wave is protecting this agent — actions are checked before they run.
            </p>
          </div>
        </div>
      ) : null}

      <ConfigureProtectionStepModal
        open={activeModal === "protection"}
        agentId={agentId}
        onClose={() => setActiveModal(null)}
        onSaved={() => {
          bump();
          showTrustToastByKey("protectionConfigured");
        }}
      />

      <ConnectAgentStepModal
        open={activeModal === "connect"}
        agentId={agentId}
        agentName={agentName}
        apiKey={apiKey}
        onClose={() => setActiveModal(null)}
        onSaved={() => {
          bump();
          showTrustToastByKey("connectionConfigured");
        }}
        onNext={() => setActiveModal("test")}
      />

      <RunTestActionStepModal
        open={activeModal === "test"}
        agentId={agentId}
        agentName={agentName}
        onClose={() => setActiveModal(null)}
        onTestPassed={() => {
          bump();
          showTrustToastByKey("testPassed");
        }}
      />
    </>
  );
}

export function AgentLiveBanner({
  agentId,
  apiKey,
  refreshKey = 0,
}: {
  agentId: string;
  apiKey: AgentApiKeyRecord | null;
  refreshKey?: number;
}) {
  const isLive = useMemo(() => {
    void refreshKey;
    return isAgentSetupLive(loadAgentLifecycle(agentId), apiKey);
  }, [agentId, apiKey, refreshKey]);

  if (!isLive) return null;

  return (
    <div className="asp-live-banner asp-live-banner-top" role="status">
      <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div>
        <p className="asp-live-title">Agent is live</p>
        <p className="asp-live-desc">All setup steps complete — Wave is actively protecting this agent.</p>
      </div>
    </div>
  );
}
