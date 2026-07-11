"use client";

import { motion } from "framer-motion";
import { FEATURES } from "@/lib/landing-data";
import {
  Scale,
  BrainCircuit,
  UserCheck,
  ScrollText,
  KeyRound,
  BellRing,
} from "lucide-react";
import SectionHeading from "./SectionHeading";

const ICON_MAP = {
  policy: Scale,
  risk: BrainCircuit,
  review: UserCheck,
  audit: ScrollText,
  token: KeyRound,
  notify: BellRing,
} as const;

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Enterprise controls for agent execution"
          description="Six core capabilities that compose into a single pre-execution decision — no bolt-on dashboards required."
          accent="cyan"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon as keyof typeof ICON_MAP] ?? Scale;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="landing-feature-card group flex h-full flex-col rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-400/20 transition-colors group-hover:bg-indigo-500/15">
                  <Icon className="h-5 w-5 text-indigo-300" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-500">
                  {feature.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
