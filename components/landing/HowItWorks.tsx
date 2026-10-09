"use client";

import { motion } from "framer-motion";

const STEPS = [
  { title: "Describe what you want", body: "Write a goal in plain language. No flowchart required." },
  { title: "Wave generates a workflow", body: "You get an editable graph: trigger, AI, tools, and safety." },
  { title: "Edit tools, logic, and approvals", body: "Change nodes, permissions, and who must approve." },
  { title: "Test, activate, and monitor", body: "Run tests, publish when valid, and pause anytime." },
];

export default function HowItWorks() {
  return (
    <section className="landing-section" id="how-it-works">
      <div className="mx-auto max-w-6xl">
        <p className="landing-kicker">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Prompt in. Protected workflow out.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <motion.article
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="landing-card p-5"
            >
              <p className="text-xs font-bold text-[var(--primary)]">Step {index + 1}</p>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
