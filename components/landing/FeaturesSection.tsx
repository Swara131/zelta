"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FEATURES } from "@/lib/landing-data";
import { ArrowUpRight } from "lucide-react";

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Features</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to secure AI agents
          </h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link
                href={feature.href}
                className="landing-feature-card group flex h-full flex-col rounded-2xl p-6 transition-all hover:ring-indigo-400/20"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-white">
                    {feature.title}
                  </h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition-all group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-500">
                  {feature.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
