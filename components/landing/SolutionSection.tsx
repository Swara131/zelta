"use client";

import { motion } from "framer-motion";
import { SOLUTIONS } from "@/lib/landing-data";
import { Languages, ShieldAlert, CheckCircle2, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  translate: Languages,
  shield: ShieldAlert,
  check: CheckCircle2,
  audit: History,
};

export default function SolutionSection() {
  return (
    <section id="solution" className="relative py-24 sm:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">The solution</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One platform from log to compliance
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            ApprovalLayer is the governance layer between your AI agents and production systems.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {SOLUTIONS.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="landing-feature-card flex gap-5 rounded-2xl p-6 sm:p-8"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/25">
                  <Icon className="h-6 w-6 text-indigo-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
