"use client";

import { motion } from "framer-motion";
import { PROBLEMS } from "@/lib/landing-data";
import { AlertOctagon, GitBranch, FileWarning } from "lucide-react";
import SectionHeading from "./SectionHeading";

const ICONS = [AlertOctagon, GitBranch, FileWarning];

export default function ProblemSection() {
  return (
    <section id="problem" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="The problem"
          title={
            <>
              Autonomous agents need guardrails
              <br />
              <span className="text-zinc-500">before execution, not after.</span>
            </>
          }
          accent="red"
        />

        <div className="grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((problem, i) => {
            const Icon = ICONS[i] ?? AlertOctagon;
            return (
              <motion.article
                key={problem.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="landing-feature-card group rounded-2xl p-8"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-400/20">
                  <Icon className="h-6 w-6 text-red-400" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">{problem.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{problem.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
