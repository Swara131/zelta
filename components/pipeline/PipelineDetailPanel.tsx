"use client";

import Link from "next/link";
import { X, ExternalLink, Zap, Layers, Cpu } from "lucide-react";
import type { PipelineStep } from "@/lib/pipeline-data";

interface PipelineDetailPanelProps {
  step: PipelineStep | null;
  onClose: () => void;
}

export default function PipelineDetailPanel({ step, onClose }: PipelineDetailPanelProps) {
  if (!step) return null;

  const Icon = step.icon;

  return (
    <>
      <div
        className="pipeline-backdrop fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="pipeline-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/10 shadow-2xl"
        role="dialog"
        aria-label={`${step.title} details`}
      >
        {/* Gradient header */}
        <div className={`relative shrink-0 bg-gradient-to-br ${step.gradient} p-6`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <Icon className="h-6 w-6 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                  {step.subtitle}
                </p>
                <h2 className="text-xl font-bold text-white">{step.title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="glass-strong flex-1 overflow-y-auto p-6">
          <p className="text-sm leading-relaxed text-zinc-400">{step.description}</p>

          {/* Metrics grid */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {step.metrics.map((m) => (
              <div
                key={m.label}
                className="glass rounded-xl p-3 text-center ring-1 ring-white/6"
              >
                <p className="font-mono text-lg font-bold text-zinc-100">{m.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                  {m.label}
                </p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Zap className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
              Capabilities
            </div>
            <ul className="space-y-2">
              {step.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 rounded-lg bg-white/2 px-3 py-2.5 text-sm text-zinc-300 ring-1 ring-white/5"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${step.gradient}`} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Tech stack */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} />
              Technology
            </div>
            <div className="flex flex-wrap gap-2">
              {step.techStack.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-400/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-white/2 p-4 ring-1 ring-white/6">
            <Layers className="h-4 w-4 text-zinc-500" strokeWidth={2} />
            <div>
              <p className="text-xs text-zinc-600">Pipeline Status</p>
              <p className="text-sm font-medium capitalize text-zinc-300">{step.status}</p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="glass-strong shrink-0 border-t border-white/8 p-4">
          {step.href ? (
            <Link
              href={step.href}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${step.gradient} px-6 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90`}
            >
              Open {step.title}
              <ExternalLink className="h-4 w-4" strokeWidth={2} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-6 py-3 text-sm font-medium text-zinc-500 ring-1 ring-white/8"
            >
              Coming soon
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
