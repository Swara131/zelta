"use client";

import { motion } from "framer-motion";
import { COMPANY_LOGOS } from "@/lib/landing-data";

export default function LogoCloud() {
  return (
    <section className="border-y border-white/6 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-zinc-600"
        >
          Trusted by security teams at
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {COMPANY_LOGOS.map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-lg font-semibold tracking-tight text-zinc-600 transition-colors hover:text-zinc-400"
            >
              {name}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
