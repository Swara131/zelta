"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import DashboardMockup from "./DashboardMockup";

export default function Hero() {
  return (
    <section className="relative px-4 pb-24 pt-32 sm:px-6 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-6xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          AI Approval Layer for Enterprise Security
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="landing-headline mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          Govern every{" "}
          <span className="landing-gradient-text">AI agent action</span>
          <br className="hidden sm:block" />
          before it becomes a breach
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl"
        >
          Upload agent logs, translate them with AI, classify risks, and route
          approvals — all in one enterprise-grade security platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link
            href="/upload"
            className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
          >
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </Link>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-8 py-4 text-base font-semibold text-zinc-300 transition-all hover:bg-white/8 hover:text-white"
          >
            View live demo
          </Link>
        </motion.div>

        <div className="mt-20">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
