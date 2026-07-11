"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  COMPANY_NAME,
  HERO_BODY,
  PRODUCT_NAME,
  TAGLINE,
} from "@/lib/public-branding";
import DashboardMockup from "./DashboardMockup";

export default function Hero() {
  return (
    <section className="relative px-4 pb-24 pt-32 sm:px-6 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-6xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-200 backdrop-blur-sm"
        >
          {PRODUCT_NAME}
          <span className="text-indigo-400/60" aria-hidden="true">
            ·
          </span>
          AI Safety Gateway
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="landing-headline mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl"
        >
          <span className="landing-gradient-text">{COMPANY_NAME}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-5 max-w-3xl text-xl font-medium tracking-tight text-zinc-200 sm:text-2xl"
        >
          {TAGLINE}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl"
        >
          {HERO_BODY}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/signup"
            className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
          >
            Start building
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </Link>
          <Link
            href="#developers"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-8 py-4 text-base font-semibold text-zinc-300 backdrop-blur-sm transition-all hover:bg-white/8 hover:text-white"
          >
            View API example
          </Link>
        </motion.div>

        <div className="mt-20">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
