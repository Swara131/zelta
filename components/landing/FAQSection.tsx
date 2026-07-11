"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FAQ_ITEMS } from "@/lib/landing-data";
import { Plus, Minus } from "lucide-react";
import SectionHeading from "./SectionHeading";

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          align="center"
          accent="zinc"
        />

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="landing-feature-card overflow-hidden rounded-xl"
            >
              <h3>
                <button
                  type="button"
                  id={`faq-trigger-${i}`}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={open === i}
                >
                  <span className="font-medium text-zinc-200">{item.q}</span>
                  {open === i ? (
                    <Minus className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-white/6 px-6 pb-5 pt-4 text-sm leading-relaxed text-zinc-500">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
