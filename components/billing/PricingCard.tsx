"use client";

import { Check, Minus } from "lucide-react";
import type { Plan, PlanId, BillingInterval } from "@/lib/billing-types";
import { formatPrice, getYearlySavings } from "@/lib/dummy-billing";

interface PricingCardProps {
  plan: Plan;
  interval: BillingInterval;
  currentPlan: PlanId;
  onSelect: (planId: PlanId) => void;
  loading?: boolean;
}

export default function PricingCard({
  plan,
  interval,
  currentPlan,
  onSelect,
  loading,
}: PricingCardProps) {
  const isCurrent = plan.id === currentPlan;
  const price =
    plan.priceLabel ??
    formatPrice(interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice, interval);

  const monthlyEquiv =
    plan.yearlyPrice && interval === "yearly"
      ? `$${Math.round(plan.yearlyPrice / 12)}/mo billed yearly`
      : null;

  const savings =
    plan.monthlyPrice && plan.yearlyPrice
      ? getYearlySavings(plan.monthlyPrice, plan.yearlyPrice)
      : null;

  return (
    <article
      className={`stripe-plan-card relative flex flex-col rounded-2xl p-6 transition-all ${
        plan.popular
          ? "stripe-plan-popular ring-2 ring-[#635BFF]"
          : "ring-1 ring-white/10"
      } ${isCurrent ? "stripe-plan-current" : ""}`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#635BFF] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
        <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl font-bold tracking-tight text-zinc-100">
            {price}
          </span>
          {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
            <span className="text-sm text-zinc-500">
              /{interval === "monthly" ? "mo" : "yr"}
            </span>
          )}
        </div>
        {monthlyEquiv && (
          <p className="mt-1 text-xs text-zinc-500">{monthlyEquiv}</p>
        )}
        {interval === "yearly" && savings && savings > 0 && (
          <p className="mt-1 text-xs font-medium text-emerald-400">
            Save {savings}% vs monthly
          </p>
        )}
      </div>

      <ul className="mb-8 flex flex-1 flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#635BFF]" strokeWidth={2.5} />
            ) : (
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-700" strokeWidth={2} />
            )}
            <span className={f.included ? "text-zinc-300" : "text-zinc-600"}>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent || loading}
        className={`stripe-plan-cta w-full rounded-xl py-3 text-sm font-semibold transition-all ${
          isCurrent
            ? "cursor-default bg-white/5 text-zinc-500 ring-1 ring-white/10"
            : plan.popular
              ? "bg-[#635BFF] text-white shadow-lg shadow-[#635BFF]/25 hover:bg-[#5851ea] hover:shadow-[#635BFF]/35"
              : "bg-white/8 text-zinc-200 ring-1 ring-white/12 hover:bg-white/12"
        } disabled:opacity-60`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="approval-btn-spinner" />
            Processing…
          </span>
        ) : isCurrent ? (
          "Current plan"
        ) : (
          plan.cta
        )}
      </button>
    </article>
  );
}
