"use client";

import { CreditCard, X } from "lucide-react";
import type { BillingInterval } from "@/lib/billing-types";
import { PLAN_LABELS } from "@/lib/billing/plans";
import { formatPlanPriceLabel, type PaidPlanId } from "@/lib/billing/pricing";
import Button from "@/components/ui/Button";

type PaymentProvider = "stripe" | "paypal";

export type CheckoutProviders = {
  stripe: boolean;
  paypal: boolean;
};

interface UpgradePaymentModalProps {
  open: boolean;
  planId: PaidPlanId;
  interval: BillingInterval;
  providers: CheckoutProviders | null;
  loadingProvider: PaymentProvider | null;
  error: string | null;
  onClose: () => void;
  onSelect: (provider: PaymentProvider) => void;
}

export default function UpgradePaymentModal({
  open,
  planId,
  interval,
  providers,
  loadingProvider,
  error,
  onClose,
  onSelect,
}: UpgradePaymentModalProps) {
  if (!open) return null;

  const stripeAvailable = providers?.stripe ?? false;
  const paypalAvailable = providers?.paypal ?? false;
  const noneAvailable = providers !== null && !stripeAvailable && !paypalAvailable;
  const loadingProviders = providers === null;
  const planLabel = PLAN_LABELS[planId];

  return (
    <>
      <div
        className="pipeline-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-4 top-[12%] z-50 mx-auto max-w-md rounded-2xl ring-1 ring-white/10 sm:inset-x-auto"
        role="dialog"
        aria-labelledby="upgrade-payment-title"
        aria-modal="true"
      >
        <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <h2
                id="upgrade-payment-title"
                className="text-lg font-semibold text-zinc-100"
              >
                Upgrade to {planLabel}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {formatPlanPriceLabel(planId, interval)} · Choose how to pay
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-3 px-5 py-5">
            {error && (
              <div
                className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-400/20"
                role="alert"
              >
                {error}
              </div>
            )}

            {noneAvailable && (
              <div
                className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/20"
                role="status"
              >
                Payment checkout is not configured yet. Add PayPal plan IDs and
                credentials on Railway, then redeploy.
              </div>
            )}

            {loadingProviders && (
              <div className="flex items-center justify-center py-6 text-sm text-zinc-500">
                <span className="approval-btn-spinner mr-2" aria-hidden="true" />
                Loading payment options…
              </div>
            )}

            {!loadingProviders && stripeAvailable && (
              <button
                type="button"
                onClick={() => onSelect("stripe")}
                disabled={!!loadingProvider}
                className="flex w-full items-center gap-4 rounded-xl bg-white/5 px-4 py-4 text-left ring-1 ring-white/10 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#635BFF]/15 text-[#635BFF]">
                  <CreditCard className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-100">Credit or debit card</p>
                  <p className="text-sm text-zinc-500">Secure checkout powered by Stripe</p>
                </div>
                {loadingProvider === "stripe" && (
                  <span className="approval-btn-spinner" aria-hidden="true" />
                )}
              </button>
            )}

            {!loadingProviders && paypalAvailable && (
              <button
                type="button"
                onClick={() => onSelect("paypal")}
                disabled={!!loadingProvider}
                className="flex w-full items-center gap-4 rounded-xl bg-white/5 px-4 py-4 text-left ring-1 ring-white/10 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0070BA]/15 text-[#0070BA]">
                  <span className="text-sm font-bold tracking-tight">PayPal</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-100">PayPal</p>
                  <p className="text-sm text-zinc-500">
                    Subscribe with your PayPal account
                  </p>
                </div>
                {loadingProvider === "paypal" && (
                  <span className="approval-btn-spinner" aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          <div className="border-t border-white/8 px-5 py-4">
            <Button variant="ghost" size="sm" onClick={onClose} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
