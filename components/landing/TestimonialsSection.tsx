"use client";

import { motion } from "framer-motion";
import { TESTIMONIALS } from "@/lib/landing-data";
import { Quote } from "lucide-react";

export default function TestimonialsSection() {
  return (
    <section className="border-y border-white/6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Loved by security leaders
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.blockquote
              key={t.author}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="landing-feature-card flex flex-col rounded-2xl p-8"
            >
              <Quote className="mb-4 h-8 w-8 text-indigo-500/40" strokeWidth={1.5} />
              <p className="flex-1 text-sm leading-relaxed text-zinc-300">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-6 flex items-center gap-3 border-t border-white/6 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-300 ring-1 ring-indigo-400/20">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{t.author}</p>
                  <p className="text-xs text-zinc-500">
                    {t.role}, {t.company}
                  </p>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
