"use client";

import { motion } from "framer-motion";
import { GATEWAY_FLOW } from "@/lib/landing-data";
import {
  Send,
  ShieldCheck,
  BrainCircuit,
  UserCheck,
  KeyRound,
  PlayCircle,
  ChevronRight,
} from "lucide-react";
import { PRODUCT_NAME } from "@/lib/public-branding";
import SectionHeading from "./SectionHeading";

const STEP_ICONS = [Send, ShieldCheck, BrainCircuit, UserCheck, KeyRound, PlayCircle];

const STATUS_COLORS: Record<string, string> = {
  pending: "from-zinc-500/20 to-zinc-500/5 text-zinc-300",
  policy: "from-indigo-500/25 to-indigo-500/5 text-indigo-200",
  risk: "from-violet-500/25 to-violet-500/5 text-violet-200",
  review: "from-amber-500/20 to-amber-500/5 text-amber-200",
  token: "from-cyan-500/20 to-cyan-500/5 text-cyan-200",
  execute: "from-emerald-500/20 to-emerald-500/5 text-emerald-200",
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow={`How ${PRODUCT_NAME} works`}
          title="Propose → decide → tokenize → execute"
          description="Every agent tool call flows through the same deterministic pipeline. Review and risk signals compose into one effective decision."
          align="center"
          accent="violet"
        />

        <div className="relative">
          <div
            className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/30 to-transparent lg:left-1/2 lg:block lg:-translate-x-px"
            aria-hidden="true"
          />

          <ol className="space-y-6">
            {GATEWAY_FLOW.map((step, i) => {
              const Icon = STEP_ICONS[i] ?? Send;
              const color = STATUS_COLORS[step.status] ?? STATUS_COLORS.pending;
              const reversed = i % 2 === 1;

              return (
                <motion.li
                  key={step.step}
                  initial={{ opacity: 0, x: reversed ? 24 : -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className={`relative flex flex-col gap-4 lg:flex-row lg:items-center ${
                    reversed ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  <div className={`lg:w-1/2 ${reversed ? "lg:pl-12" : "lg:pr-12"}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className={`landing-pipeline-step rounded-2xl bg-gradient-to-br p-6 ${color}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 text-left">
                          <span className="font-mono text-xs opacity-70">{step.step}</span>
                          <h3 className="mt-0.5 text-lg font-semibold text-white">{step.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div
                    className="absolute left-6 hidden h-3 w-3 rounded-full bg-indigo-400 ring-4 ring-[#06060a] lg:left-1/2 lg:block lg:-translate-x-1.5"
                    aria-hidden="true"
                  />

                  <div className="hidden lg:block lg:w-1/2" aria-hidden="true" />

                  {i < GATEWAY_FLOW.length - 1 && (
                    <motion.div
                      className="flex justify-center py-1 lg:hidden"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
                      aria-hidden="true"
                    >
                      <ChevronRight className="h-5 w-5 rotate-90 text-zinc-600" strokeWidth={2} />
                    </motion.div>
                  )}
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
