"use client";

import type { PipelineStep } from "@/lib/pipeline-data";

interface PipelineNodeProps {
  step: PipelineStep;
  index: number;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

const STATUS_DOT = {
  complete: "bg-emerald-400 shadow-emerald-400/50",
  active: "bg-amber-400 shadow-amber-400/50 animate-pulse",
  idle: "bg-zinc-600 shadow-zinc-600/30",
};

export default function PipelineNode({
  step,
  index,
  isSelected,
  isActive,
  onClick,
}: PipelineNodeProps) {
  const Icon = step.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`pipeline-node group relative w-full max-w-md text-left transition-all duration-500 ${
        isSelected ? "pipeline-node-selected scale-[1.02]" : "hover:scale-[1.01]"
      }`}
      style={{
        animationDelay: `${index * 120}ms`,
        ["--node-glow" as string]: step.glowColor,
      }}
      aria-pressed={isSelected}
    >
      <div
        className={`glass-strong pipeline-node-inner overflow-hidden rounded-2xl ring-1 transition-all duration-300 ${
          isSelected
            ? "ring-white/20 shadow-lg"
            : "ring-white/8 hover:ring-white/14"
        }`}
        style={{
          boxShadow: isSelected ? `0 0 40px ${step.glowColor}` : undefined,
        }}
      >
        {/* Gradient header strip */}
        <div className={`h-1 bg-gradient-to-r ${step.gradient}`} />

        <div className="flex items-center gap-4 p-5">
          {/* Icon with gradient bg */}
          <div
            className={`pipeline-icon-wrap relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.gradient} shadow-lg transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon className="relative z-10 h-6 w-6 text-white" strokeWidth={1.75} />
            {isActive && <span className="pipeline-icon-pulse absolute inset-0 rounded-xl" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full shadow-sm ${STATUS_DOT[step.status]}`}
              />
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {step.subtitle}
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-semibold text-zinc-100">{step.title}</h3>
            <p className="mt-1 truncate text-sm text-zinc-500">{step.description}</p>
          </div>

          <div className="shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Quick metrics strip */}
        <div className="flex border-t border-white/6">
          {step.metrics.slice(0, 2).map((m) => (
            <div key={m.label} className="flex-1 px-5 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">{m.label}</p>
              <p className="font-mono text-sm font-semibold text-zinc-300">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
