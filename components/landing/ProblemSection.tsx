"use client";

import { motion } from "framer-motion";
import { PROBLEMS } from "@/lib/landing-data";
import { AlertOctagon } from "lucide-react";

export default function ProblemSection() {
  return (
    <section id="problem" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-red-400">The problem</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AI agents are powerful.
            <br />
            <span className="text-zinc-500">Unsupervised access is catastrophic.</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((problem, i) => (
            <motion.article
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="landing-feature-card group rounded-2xl p-8"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-400/20">
                <AlertOctagon className="h-6 w-6 text-red-400" strokeWidth={1.5} />
              </div>
              <p className="font-mono text-3xl font-bold text-red-400">{problem.stat}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-600">
                {problem.statLabel}
              </p>
              <h3 className="mt-6 text-lg font-semibold text-zinc-100">{problem.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{problem.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
