"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="landing-cta-section relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16 sm:py-20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-cyan-600/10" />
        <div className="absolute inset-0 backdrop-blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to govern your AI agents?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
            Join security teams who trust ApprovalLayer to translate, classify, and approve
            every agent action before it hits production.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/upload"
              className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              Start for free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
            </Link>
            <Link
              href="/billing"
              className="text-base font-medium text-zinc-300 transition-colors hover:text-white"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
