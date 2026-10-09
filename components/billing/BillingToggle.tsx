"use client";

import type { BillingInterval } from "@/lib/billing-types";

interface BillingToggleProps {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}

export default function BillingToggle({ interval, onChange }: BillingToggleProps) {
  return (
    <div className="stripe-toggle-wrap inline-flex items-center gap-3">
      <div className="stripe-toggle inline-flex rounded-full p-1 ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            interval === "monthly"
              ? "stripe-toggle-active bg-[#635BFF] text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            interval === "yearly"
              ? "stripe-toggle-active bg-[#635BFF] text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Yearly
        </button>
      </div>
      {interval === "yearly" ? (
        <span className="stripe-save-badge stripe-save-badge-pop rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-400/25">
          Save 20%
        </span>
      ) : null}
    </div>
  );
}
