"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

interface AgentSetupCompleteCardProps {
  agentName: string;
  actionsProcessed: number;
  agentId: string;
}

export default function AgentSetupCompleteCard({
  agentName,
  actionsProcessed,
  agentId,
}: AgentSetupCompleteCardProps) {
  const testHref = `/test-action?agent=${encodeURIComponent(agentId)}`;

  return (
    <section className="asp-card asp-complete-card" aria-labelledby="asp-complete-heading">
      <div className="asp-complete-glow" aria-hidden="true" />
      <Sparkles className="asp-complete-sparkle" strokeWidth={1.75} aria-hidden="true" />
      <h2 id="asp-complete-heading" className="asp-complete-title">
        You&apos;re all set!
      </h2>
      <p className="asp-complete-lead">
        <CheckCircle2 className="asp-complete-check" strokeWidth={2} aria-hidden="true" />
        {agentName} is now protecting your actions
      </p>
      <p className="asp-complete-stat">
        {actionsProcessed > 0 ? (
          <>
            <strong>{actionsProcessed}</strong> action{actionsProcessed === 1 ? "" : "s"}{" "}
            processed so far
          </>
        ) : (
          <>
            <strong>0</strong> actions processed yet{" "}
            <span className="asp-complete-stat-muted">(waiting for first action)</span>
          </>
        )}
      </p>
      <div className="asp-complete-actions">
        <Link href={testHref} className="asp-complete-btn asp-complete-btn-primary">
          Run test action
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
