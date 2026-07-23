"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Sparkles } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import BillingToggle from "./BillingToggle";
import PricingCard from "./PricingCard";
import UsagePanel from "./UsagePanel";
import InvoiceTable from "./InvoiceTable";
import UpgradePaymentModal, {
  type CheckoutProviders,
} from "./UpgradePaymentModal";
import { PLANS, DUMMY_BILLING } from "@/lib/dummy-billing";
import { PLAN_LABELS, hasMinimumPlan } from "@/lib/billing/plans";
import type { PaidPlanId } from "@/lib/billing/pricing";
import type { BillingData, BillingInterval, PlanId } from "@/lib/billing-types";

type PaymentProvider = "stripe" | "paypal";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const checkoutPlanParam = searchParams.get("plan");
  const upgradedPlanName =
    checkoutPlanParam && checkoutPlanParam in PLAN_LABELS
      ? PLAN_LABELS[checkoutPlanParam as PlanId]
      : "Professional";

  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [billingData, setBillingData] = useState<BillingData>(DUMMY_BILLING);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanId>("professional");
  const [dismissedSuccess, setDismissedSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkoutProviders, setCheckoutProviders] =
    useState<CheckoutProviders | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(
    null
  );
  const upgraded = checkoutSuccess && !dismissedSuccess;

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      try {
        const response = await fetch("/api/billing");
        if (!response.ok) return;
        const payload = (await response.json()) as BillingData;
        if (!cancelled && payload.currentPlan) {
          setBillingData(payload);
          setInterval(payload.interval);
        }
      } catch {
        /* keep fallback data */
      }
    }

    void loadBilling();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!checkoutSuccess) return undefined;

    window.history.replaceState({}, "", "/billing");
    const timeout = window.setTimeout(() => setDismissedSuccess(true), 3000);
    return () => window.clearTimeout(timeout);
  }, [checkoutSuccess]);

  const loadCheckoutProviders = useCallback(
    async (planId: PaidPlanId, billingInterval: BillingInterval) => {
      try {
        const response = await fetch(
          `/api/billing/checkout/options?plan=${planId}&interval=${billingInterval}`
        );
        if (!response.ok) {
          setCheckoutProviders({ stripe: false, paypal: false });
          return;
        }
        const payload = (await response.json()) as {
          providers: CheckoutProviders;
        };
        setCheckoutProviders(payload.providers);
      } catch {
        setCheckoutProviders({ stripe: false, paypal: false });
      }
    },
    []
  );

  const openUpgradeModal = useCallback(
    async (planId: PaidPlanId) => {
      setSelectedPlan(planId);
      setCheckoutError(null);
      setShowPaymentModal(true);
      setCheckoutProviders(null);
      await loadCheckoutProviders(planId, interval);
    },
    [interval, loadCheckoutProviders]
  );

  useEffect(() => {
    if (!showPaymentModal) return;
    void loadCheckoutProviders(selectedPlan, interval);
  }, [interval, loadCheckoutProviders, selectedPlan, showPaymentModal]);

  const currentPlan = billingData.currentPlan;
  const currentPlanData = PLANS.find((p) => p.id === currentPlan)!;

  const startCheckout = async (provider: PaymentProvider) => {
    setCheckoutError(null);
    setLoadingProvider(provider);

    try {
      const endpoint =
        provider === "paypal"
          ? "/api/billing/checkout/paypal"
          : "/api/billing/checkout";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan, interval }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setCheckoutError(
          payload.error ?? "Could not start checkout. Please try again."
        );
        return;
      }

      window.location.href = payload.url;
    } catch {
      setCheckoutError("Could not start checkout. Please try again.");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSelectPlan = async (planId: PlanId) => {
    if (planId === currentPlan) return;

    if (planId === "free" && currentPlan !== "free") {
      setLoadingPlan(planId);
      try {
        const response = await fetch("/api/billing/portal", { method: "POST" });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (payload.url) {
          window.location.href = payload.url;
          return;
        }
        setCheckoutError(payload.error ?? "Could not open billing portal.");
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    if (
      (planId === "professional" || planId === "team") &&
      hasMinimumPlan(planId, currentPlan) &&
      planId !== currentPlan
    ) {
      await openUpgradeModal(planId);
    }
  };

  const handleUpgrade = () => {
    const nextPlan: PaidPlanId =
      currentPlan === "free" ? "professional" : "team";
    void openUpgradeModal(nextPlan);
  };

  const openPortal = async () => {
    setLoadingPlan(currentPlan);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      setCheckoutError(payload.error ?? "Could not open billing portal.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const upgradeCta =
    currentPlan === "free"
      ? "Upgrade to Professional"
      : currentPlan === "professional"
        ? "Upgrade to Team"
        : null;

  return (
    <PageShell maxWidth="6xl" className="stripe-billing-page">
      <PageHeader
        icon={CreditCard}
        title="Billing"
        description="Manage your subscription, usage, and payment history."
      />

      <section className="ds-section stripe-current-plan ds-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="ds-label text-[var(--ds-brand)]">Current plan</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ds-text-primary)]">
              {currentPlanData.name}
            </h3>
            <p className="mt-2 ds-page-description !mt-2 !max-w-none">
              {currentPlan === "free"
                ? "Upgrade to unlock AI Translator, advanced analytics, and more."
                : `Renews on ${new Date(billingData.nextBillingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            </p>
            {currentPlan !== "free" && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => void openPortal()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openPortal();
                  }
                }}
                className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--ds-text-secondary)]"
              >
                <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {billingData.paymentMethod.brand} ···· {billingData.paymentMethod.last4}
                <span className="text-[var(--ds-text-muted)]">
                  Exp {billingData.paymentMethod.expMonth}/
                  {billingData.paymentMethod.expYear}
                </span>
              </div>
            )}
          </div>

          {upgradeCta && (
            <Button
              variant="primary"
              size="lg"
              icon={Sparkles}
              loading={loadingPlan !== null && showPaymentModal}
              onClick={handleUpgrade}
              disabled={!!loadingPlan}
            >
              {loadingPlan !== null && showPaymentModal ? "Upgrading…" : upgradeCta}
            </Button>
          )}
        </div>

        {checkoutError && !showPaymentModal && (
          <div
            className="mt-4 rounded-[var(--ds-radius-md)] bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-400/20"
            role="alert"
          >
            {checkoutError}
          </div>
        )}

        {upgraded && (
          <div
            className="mt-4 rounded-[var(--ds-radius-md)] bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 ring-1 ring-emerald-400/20"
            role="status"
          >
            Successfully upgraded to {upgradedPlanName}! Your new limits are now
            active.
          </div>
        )}
      </section>

      <UpgradePaymentModal
        open={showPaymentModal}
        planId={selectedPlan}
        interval={interval}
        providers={checkoutProviders}
        loadingProvider={loadingProvider}
        error={checkoutError}
        onClose={() => {
          setShowPaymentModal(false);
          setCheckoutError(null);
          setLoadingProvider(null);
        }}
        onSelect={(provider) => {
          void startCheckout(provider);
        }}
      />

      <section className="ds-section">
        <UsagePanel usage={billingData.usage} planName={currentPlanData.name} />
      </section>

      <section className="ds-section">
        <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            title="Plans"
            description="Choose the plan that fits your team."
          />
          <BillingToggle interval={interval} onChange={setInterval} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              interval={interval}
              currentPlan={currentPlan}
              onSelect={handleSelectPlan}
              loading={loadingPlan === plan.id}
            />
          ))}
        </div>
      </section>

      <section className="ds-section">
        <InvoiceTable invoices={billingData.invoices} />
      </section>
    </PageShell>
  );
}
