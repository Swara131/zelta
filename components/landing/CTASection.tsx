"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/public-branding";

export default function CTASection() {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32" aria-labelledby="cta-heading">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="landing-cta-section relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16 sm:py-20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-blue-600/10" aria-hidden="true" />
        <div className="absolute inset-0 backdrop-blur-3xl" aria-hidden="true" />
        <div className="relative">
          <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Put approval in front of execution
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
            Create an agent API key, propose your first action through {PRODUCT_NAME}, and wire
            the gateway into your tool-calling loop in under an hour.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              Create free account
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/integrations"
              className="text-base font-medium text-zinc-300 transition-colors hover:text-white"
            >
              Read integration docs →
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
