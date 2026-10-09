"use client";

import { Check, Minus } from "lucide-react";
import type { Plan, PlanId, BillingInterval } from "@/lib/billing-types";
import { formatPrice, getYearlySavings } from "@/lib/dummy-billing";

interface PricingCardProps {
  plan: Plan;
  interval: BillingInterval;
  currentPlan: PlanId;
  onSelect: (planId: PlanId) => void;
  onContact?: () => void;
  loading?: boolean;
}

export default function PricingCard({
  plan,
  interval,
  currentPlan,
  onSelect,
  onContact,
  loading,
}: PricingCardProps) {
  const isCurrent = plan.id === currentPlan;
  const isBusiness = plan.id === "team";
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

  const handleClick = () => {
    if (isBusiness && onContact) {
      onContact();
      return;
    }
    onSelect(plan.id);
  };

  return (
    <article
      className={`bill-plan-card stripe-plan-card relative flex flex-col rounded-2xl p-6 ${
        plan.popular ? "stripe-plan-popular ring-2 ring-[#635BFF]" : "ring-1 ring-white/10"
      } ${isCurrent ? "stripe-plan-current" : ""}`}
    >
      {plan.popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#635BFF] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Most popular
        </span>
      ) : null}

      <div className="mb-5">
        <h3 className="text-xl font-bold text-[var(--ds-text-primary)]">{plan.name}</h3>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">{plan.description}</p>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-[var(--ds-text-primary)]">
            {price}
          </span>
          {plan.monthlyPrice !== null && plan.monthlyPrice > 0 ? (
            <span className="text-sm text-[var(--ds-text-tertiary)]">
              /{interval === "monthly" ? "mo" : "yr"}
            </span>
          ) : plan.monthlyPrice === 0 ? (
            <span className="text-sm text-[var(--ds-text-tertiary)]">/ month</span>
          ) : null}
        </div>
        {monthlyEquiv ? <p className="mt-1 text-xs text-[var(--ds-text-tertiary)]">{monthlyEquiv}</p> : null}
        {interval === "yearly" && savings && savings > 0 ? (
          <p className="mt-1 text-xs font-medium text-emerald-400">Save {savings}% vs monthly</p>
        ) : null}
      </div>

      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#635BFF]" strokeWidth={2.5} />
            ) : (
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-700" strokeWidth={2} />
            )}
            <span className={f.included ? "text-[var(--ds-text-secondary)]" : "text-zinc-600"}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleClick}
        disabled={isCurrent || loading}
        className={`stripe-plan-cta w-full rounded-xl py-3 text-sm font-semibold transition-all ${
          isCurrent
            ? "cursor-default bg-white/5 text-zinc-500 ring-1 ring-white/10"
            : plan.popular
              ? "bg-[#635BFF] text-white shadow-lg shadow-[#635BFF]/25 hover:bg-[#5851ea]"
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
