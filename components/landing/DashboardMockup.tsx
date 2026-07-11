"use client";

import { motion } from "framer-motion";
import { Shield, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

const EVENTS = [
  { label: "Policy: review_required", tone: "amber" },
  { label: "Risk: high · confidence 0.82", tone: "violet" },
  { label: "Reviewer approved", tone: "emerald" },
  { label: "Token issued · expires 5m", tone: "cyan" },
];

export default function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="landing-mockup relative mx-auto w-full max-w-4xl perspective-[1200px]"
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-blue-500/15 blur-2xl" aria-hidden="true" />

      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12]/90 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="ml-3 font-mono text-[11px] text-zinc-600">gateway · proposal review</span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-5 sm:p-6">
          <div className="space-y-3 sm:col-span-3">
            <div className="rounded-xl bg-white/3 p-4 ring-1 ring-white/6">
              <div className="flex flex-wrap items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-400" strokeWidth={2} aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-200">financial.refund</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Review required
                </span>
              </div>
              <p className="mt-3 font-mono text-xs leading-relaxed text-zinc-500">
                agent_prod_01 · issue_refund · cus_demo · INR 50,000
              </p>
            </div>

            <div className="space-y-2">
              {EVENTS.map((event, i) => (
                <motion.div
                  key={event.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.12 }}
                  className="flex items-center gap-2 rounded-lg bg-white/3 px-3 py-2 ring-1 ring-white/5"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        event.tone === "amber"
                          ? "#fbbf24"
                          : event.tone === "violet"
                            ? "#a78bfa"
                            : event.tone === "emerald"
                              ? "#34d399"
                              : "#22d3ee",
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] text-zinc-400">{event.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div className="rounded-xl bg-white/3 p-4 ring-1 ring-white/6">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Review deadline
              </div>
              <p className="mt-2 font-mono text-lg font-semibold text-zinc-100">14:32 UTC</p>
            </div>

            <div className="rounded-xl bg-white/3 p-4 ring-1 ring-white/6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Effective decision</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2} aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-medium text-emerald-300">Approved · token pending</p>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={2} aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-amber-200/80">
                Hybrid mode escalated high-severity ML signal to human review.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
