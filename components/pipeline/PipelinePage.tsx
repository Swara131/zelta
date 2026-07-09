"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Activity, Clock, CheckCircle, Play, Pause } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import PipelineNode from "./PipelineNode";
import PipelineConnector from "./PipelineConnector";
import PipelineDetailPanel from "./PipelineDetailPanel";
import { PIPELINE_STEPS, PIPELINE_STATS } from "@/lib/pipeline-data";
import type { PipelineStep } from "@/lib/pipeline-data";

export default function PipelinePage() {
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setActiveFlowIndex((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const handleNodeClick = useCallback((step: PipelineStep) => {
    setSelectedStep(step);
    setIsAnimating(false);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedStep(null);
    setIsAnimating(true);
  }, []);

  useEffect(() => {
    if (!selectedStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClosePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedStep, handleClosePanel]);

  return (
    <PageShell>
      <PageHeader
        icon={GitBranch}
        title="AI Pipeline"
        description="Visual orchestration from log ingestion to analytics. Click any stage to explore capabilities, metrics, and technology stack."
        badge={
          <span className="ds-badge ds-badge-brand">
            <GitBranch className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            End-to-end workflow
          </span>
        }
      />

      <section
        className="ds-section grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Pipeline statistics"
      >
        {[
          { icon: Activity, label: "Total Runs", value: PIPELINE_STATS.totalRuns.toLocaleString() },
          { icon: Clock, label: "Avg. Duration", value: PIPELINE_STATS.avgDuration },
          { icon: CheckCircle, label: "Success Rate", value: PIPELINE_STATS.successRate },
          { icon: GitBranch, label: "Active Now", value: String(PIPELINE_STATS.activeNow) },
        ].map(({ icon: Icon, label, value }, i) => (
          <div
            key={label}
            className={`ds-stat-card fade-in-up`}
            style={{ animationDelay: `${0.05 + i * 0.05}s` }}
          >
            <div className="ds-stat-label">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {label}
            </div>
            <p className="ds-stat-value">{value}</p>
          </div>
        ))}
      </section>

      <div className="mb-6 flex justify-center">
        <Button
          variant="secondary"
          size="sm"
          icon={isAnimating ? Pause : Play}
          onClick={() => setIsAnimating(!isAnimating)}
          aria-pressed={isAnimating}
        >
          {isAnimating ? "Pause flow animation" : "Resume flow animation"}
        </Button>
      </div>

      <div className="pipeline-flow mx-auto flex max-w-md flex-col items-center" role="list" aria-label="Pipeline stages">
        {PIPELINE_STEPS.map((step, index) => (
          <div key={step.id} className="flex w-full flex-col items-center" role="listitem">
            <div
              className="w-full pipeline-node-enter"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <PipelineNode
                step={step}
                index={index}
                isSelected={selectedStep?.id === step.id}
                isActive={isAnimating && activeFlowIndex === index}
                onClick={() => handleNodeClick(step)}
              />
            </div>

            {index < PIPELINE_STEPS.length - 1 && (
              <PipelineConnector
                index={index}
                gradient={step.gradient}
                isFlowing={isAnimating && activeFlowIndex >= index}
              />
            )}
          </div>
        ))}
      </div>

      <div className="fade-in-up mx-auto mt-12 flex max-w-md flex-wrap items-center justify-center gap-4 ds-caption">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Complete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-600" aria-hidden="true" />
          Idle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-px bg-gradient-to-b from-indigo-500 to-violet-500" aria-hidden="true" />
          Data flow
        </span>
      </div>

      <PipelineDetailPanel step={selectedStep} onClose={handleClosePanel} />
    </PageShell>
  );
}
