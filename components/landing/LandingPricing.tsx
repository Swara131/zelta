"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/dummy-billing";

export default function LandingPricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <div className="mt-8 inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                !yearly ? "bg-white text-black" : "text-zinc-400"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                yearly ? "bg-white text-black" : "text-zinc-400"
              }`}
            >
              Yearly
            </button>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const price =
              plan.priceLabel ??
              (yearly
                ? plan.yearlyPrice === 0
                  ? "$0"
                  : `$${plan.yearlyPrice}`
                : plan.monthlyPrice === 0
                  ? "$0"
                  : `$${plan.monthlyPrice}`);

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`landing-feature-card flex flex-col rounded-2xl p-8 ${
                  plan.popular ? "ring-2 ring-indigo-500/50" : ""
                }`}
              >
                {plan.popular && (
                  <span className="mb-4 w-fit rounded-full bg-indigo-500/15 px-3 py-0.5 text-xs font-semibold text-indigo-300">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-bold text-white">{price}</span>
                  {!plan.priceLabel && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                    <span className="text-zinc-500">/{yearly ? "yr" : "mo"}</span>
                  )}
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-sm">
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" strokeWidth={2.5} />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span className={f.included ? "text-zinc-400" : "text-zinc-700"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/billing"
                  className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                    plan.popular
                      ? "landing-cta-primary text-white"
                      : "bg-white/8 text-zinc-200 ring-1 ring-white/10 hover:bg-white/12"
                  }`}
                >
                  {plan.id === "enterprise" ? "Contact sales" : "Get started"}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
