"use client";

import { motion } from "framer-motion";
import { ARCHITECTURE_NODES } from "@/lib/landing-data";
import { PRODUCT_NAME } from "@/lib/public-branding";
import SectionHeading from "./SectionHeading";

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Architecture"
          title={
            <>
              One gateway.
              <br />
              <span className="text-zinc-500">Every control point connected.</span>
            </>
          }
          description={`${PRODUCT_NAME} centralizes propose, policy, risk, review, token issuance, audit, and notifications — without replacing your agent runtime.`}
          accent="cyan"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="landing-glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-10"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.2), transparent 45%)",
            }}
          />

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ARCHITECTURE_NODES.map((node, i) => (
              <motion.article
                key={node.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="landing-feature-card group relative rounded-2xl p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="landing-arch-dot h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {node.id}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-zinc-100">{node.label}</h3>
                <p className="mt-1 text-sm text-zinc-500">{node.sub}</p>
              </motion.article>
            ))}
          </div>

          <div className="relative mt-8 hidden lg:block" aria-hidden="true">
            <svg viewBox="0 0 900 120" className="w-full text-indigo-400/30">
              <motion.path
                d="M60 60 H840"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="6 8"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
              {[60, 180, 300, 420, 540, 660, 780, 840].map((x, i) => (
                <motion.circle
                  key={x}
                  cx={x}
                  cy={60}
                  r={4}
                  fill="currentColor"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                />
              ))}
            </svg>
          </div>

          <p className="relative mt-6 text-center text-sm text-zinc-500">
            Agents never bypass the gateway — policy, risk, and human review compose a single effective
            decision before any token is issued.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
