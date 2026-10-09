"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/dummy-billing";

export default function LandingPricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="landing-section pt-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="landing-kicker">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Plans that scale with your agents</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[var(--text-secondary)]">
            Start free. Upgrade when you need more runs, approvals, and team controls.
          </p>
          <div className="mt-8 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium ${
                !yearly ? "bg-[var(--primary-soft)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium ${
                yearly ? "bg-[var(--primary-soft)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
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
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`landing-card flex flex-col p-8 ${plan.popular ? "ring-2 ring-[var(--primary)]" : ""}`}
              >
                {plan.popular ? (
                  <span className="mb-4 w-fit rounded-full bg-[var(--primary-soft)] px-3 py-0.5 text-xs font-semibold text-[var(--primary)]">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">{price}</span>
                  {!plan.priceLabel && plan.monthlyPrice !== null && plan.monthlyPrice > 0 ? (
                    <span className="text-[var(--text-secondary)]">/{yearly ? "yr" : "mo"}</span>
                  ) : null}
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-sm">
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2.5} />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span className="text-[var(--text-secondary)]">{f.text}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/billing"
                  className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold ${
                    plan.popular ? "landing-cta-primary" : "landing-cta-secondary"
                  }`}
                >
                  Get started
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
