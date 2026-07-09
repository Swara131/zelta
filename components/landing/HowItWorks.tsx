"use client";

import { motion } from "framer-motion";
import { PIPELINE_STEPS } from "@/lib/landing-data";
import { ChevronDown } from "lucide-react";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-400">
            How ApprovalLayer works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Six steps to full agent governance
          </h2>
        </motion.div>

        <div className="flex flex-col items-center">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.label} className="flex w-full max-w-md flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.03 }}
                className="landing-pipeline-step w-full rounded-2xl px-6 py-5 text-center"
              >
                <span className="font-mono text-xs text-indigo-400">0{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold text-white">{step.label}</h3>
                <p className="mt-0.5 text-sm text-zinc-500">{step.desc}</p>
              </motion.div>

              {i < PIPELINE_STEPS.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 + 0.05 }}
                  className="flex flex-col items-center py-2"
                >
                  <motion.div
                    animate={{ y: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  >
                    <ChevronDown className="h-5 w-5 text-zinc-600" strokeWidth={2} />
                  </motion.div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
