"use client";

import { motion } from "framer-motion";
import { BUILDER_LOGOS } from "@/lib/landing-data";

export default function LogoCloud() {
  return (
    <section className="border-y border-white/6 py-14" aria-label="Trusted by AI builders">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-10 text-center text-sm font-medium uppercase tracking-wider text-zinc-500"
        >
          Trusted by AI builders
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {BUILDER_LOGOS.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/3 text-xs font-bold text-zinc-500"
                aria-hidden="true"
              >
                {name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-base font-semibold tracking-tight">{name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
