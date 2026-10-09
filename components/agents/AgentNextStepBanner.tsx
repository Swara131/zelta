"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentLifecycleProgress } from "@/lib/agent-builder/agent-lifecycle";
import {
  getNextStepGuidance,
  type NextStepModal,
} from "@/lib/agent-builder/next-step-guidance";

interface AgentNextStepBannerProps {
  agentId: string;
  lifecycle: AgentLifecycleProgress;
  apiKey: AgentApiKeyRecord | null;
  onOpenModal?: (modal: NextStepModal) => void;
  className?: string;
}

function toneClass(tone: ReturnType<typeof getNextStepGuidance>["tone"]): string {
  switch (tone) {
    case "warn":
      return "ans-banner-warn";
    case "success":
      return "ans-banner-success";
    default:
      return "ans-banner-info";
  }
}

export default function AgentNextStepBanner({
  agentId,
  lifecycle,
  apiKey,
  onOpenModal,
  className = "",
}: AgentNextStepBannerProps) {
  const guidance = getNextStepGuidance(agentId, lifecycle, apiKey);

  return (
    <aside
      className={`ans-banner ${toneClass(guidance.tone)} ${className}`.trim()}
      aria-labelledby={`ans-heading-${agentId}`}
    >
      <div className="ans-banner-body">
        <p id={`ans-heading-${agentId}`} className="ans-banner-kicker">
          Next step
        </p>
        <p className="ans-banner-message">{guidance.message}</p>
      </div>

      {guidance.buttonLabel && guidance.modal ? (
        <button
          type="button"
          className="ans-banner-btn"
          onClick={() => onOpenModal?.(guidance.modal!)}
        >
          {guidance.buttonLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}

      {guidance.buttonLabel && guidance.href ? (
        <Link href={guidance.href} className="ans-banner-btn">
          {guidance.buttonLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </aside>
  );
}
