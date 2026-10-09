"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import BillingCurrentPlan from "./BillingCurrentPlan";
import BillingUsageSection from "./BillingUsageSection";
import PlanComparisonTable from "./PlanComparisonTable";
import BillingPlanCards from "./BillingPlanCards";
import BillingUpgradeValue from "./BillingUpgradeValue";
import WhyZeltaBillingTeaser from "@/components/marketing/WhyZeltaBillingTeaser";
import BillingFaqs from "./BillingFaqs";
import BillingAnnualPricingNote from "./BillingAnnualPricingNote";
import InvoiceTable from "./InvoiceTable";
import BillingToggle from "./BillingToggle";
import CancelBillingModal from "./CancelBillingModal";
import UpgradePaymentModal, {
  type CheckoutProviders,
} from "./UpgradePaymentModal";
import { DUMMY_BILLING } from "@/lib/dummy-billing";
import {
  countApprovalRequestsFromAudit,
  getPlanStatusDisplay,
  MANAGE_BILLING_UNAVAILABLE_COPY,
  mapFounderUsage,
  PAYMENTS_NOT_CONFIGURED_COPY,
  type MarketingPlanId,
} from "@/lib/billing/founder-billing-copy";
import type { PaidPlanId } from "@/lib/billing/pricing";
import type { AuditTimelineEntry } from "@/lib/audit/types";
import type { BillingData, BillingInterval, PlanId } from "@/lib/billing-types";

type PaymentProvider = "stripe" | "paypal";

const BUSINESS_CONTACT_EMAIL = "sales@zelta.com";

async function fetchAuditEntries(): Promise<AuditTimelineEntry[]> {
  const response = await fetch("/api/audit/timeline?limit=200");
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { entries?: AuditTimelineEntry[] };
  return payload.entries ?? [];
}

export default function BillingPage() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [billingData, setBillingData] = useState<BillingData>(DUMMY_BILLING);
  const [auditEntries, setAuditEntries] = useState<AuditTimelineEntry[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<MarketingPlanId | PlanId | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanId>("professional");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [checkoutProviders, setCheckoutProviders] =
    useState<CheckoutProviders | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(
    null
  );
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);

  const loadBillingData = useCallback(async () => {
    setLoadingBilling(true);
    try {
      const [billingRes, keysRes, auditRes, subscriptionRes] = await Promise.all([
        fetch("/api/billing"),
        fetch("/api/gateway/keys"),
        fetchAuditEntries(),
        fetch("/api/billing/subscription"),
      ]);

      if (billingRes.ok) {
        const payload = (await billingRes.json()) as BillingData;
        if (payload.currentPlan) {
          setBillingData(payload);
          setInterval(payload.interval);
        }
      }

      if (keysRes.ok) {
        const payload = (await keysRes.json()) as { keys?: { revokedAt: string | null }[] };
        const active = (payload.keys ?? []).filter((key) => !key.revokedAt);
        setAgentCount(active.length);
      }

      if (auditRes) {
        setAuditEntries(auditRes);
      }

      if (subscriptionRes.ok) {
        const payload = (await subscriptionRes.json()) as {
          stripeCustomerId?: string | null;
          cancelAtPeriodEnd?: boolean;
        };
        setHasStripeCustomer(!!payload.stripeCustomerId);
        setCancelAtPeriodEnd(!!payload.cancelAtPeriodEnd);
      }
    } catch {
      /* keep fallback data */
    } finally {
      setLoadingBilling(false);
    }
  }, []);

  useEffect(() => {
    void loadBillingData();
  }, [loadBillingData]);

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

  useEffect(() => {
    void loadCheckoutProviders("professional", interval);
  }, [interval, loadCheckoutProviders]);

  const paymentsConfigured = useMemo(
    () =>
      checkoutProviders?.stripe === true || checkoutProviders?.paypal === true,
    [checkoutProviders]
  );

  const currentPlan = billingData.currentPlan;
  const actionsUsed =
    billingData.usage.find((metric) => metric.label === "API Calls")?.used ?? 0;
  const approvalRequestsUsed = useMemo(
    () => countApprovalRequestsFromAudit(auditEntries),
    [auditEntries]
  );

  const founderUsage = useMemo(
    () =>
      mapFounderUsage(
        currentPlan,
        actionsUsed,
        agentCount,
        approvalRequestsUsed,
        interval
      ),
    [actionsUsed, agentCount, approvalRequestsUsed, currentPlan, interval]
  );

  const planStatus = useMemo(
    () =>
      getPlanStatusDisplay(
        currentPlan,
        interval,
        billingData.nextBillingDate,
        hasStripeCustomer
      ),
    [billingData.nextBillingDate, currentPlan, hasStripeCustomer, interval]
  );

  const openUpgradeModal = useCallback(
    async (planId: PaidPlanId = "professional") => {
      if (!paymentsConfigured) {
        setCheckoutError(PAYMENTS_NOT_CONFIGURED_COPY);
        return;
      }
      setSelectedPlan(planId);
      setCheckoutError(null);
      setShowPaymentModal(true);
      setCheckoutProviders(null);
      await loadCheckoutProviders(planId, interval);
    },
    [interval, loadCheckoutProviders, paymentsConfigured]
  );

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
          payload.error ?? "Could not start checkout. Payment may not be configured yet."
        );
        return;
      }

      window.location.href = payload.url;
    } catch {
      setCheckoutError("Could not start checkout. Payment may not be configured yet.");
    } finally {
      setLoadingProvider(null);
    }
  };

  const openPortal = async () => {
    if (!hasStripeCustomer) {
      setCheckoutError(MANAGE_BILLING_UNAVAILABLE_COPY);
      return;
    }

    setLoadingPlan(currentPlan);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      setCheckoutError(payload.error ?? MANAGE_BILLING_UNAVAILABLE_COPY);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCancelSubscription = async (feedback: string) => {
    setCancelLoading(true);
    setCancelError(null);

    try {
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setCancelError(payload.error ?? "Could not cancel subscription.");
        return;
      }

      setShowCancelModal(false);
      setCancelConfirmed(true);
      setCancelAtPeriodEnd(true);
    } catch {
      setCancelError("Could not cancel subscription. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleContactEnterprise = () => {
    const subject = encodeURIComponent("Wave Pro plan inquiry");
    const body = encodeURIComponent(
      "Hi Wave team,\n\nI'm interested in the Pro / Enterprise plan.\n\n"
    );
    window.location.href = `mailto:${BUSINESS_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const handleSelectPlan = async (marketingPlanId: MarketingPlanId) => {
    const currentMarketing =
      currentPlan === "free" ? "free" : currentPlan === "team" ? "pro" : "growth";

    if (marketingPlanId === currentMarketing) return;

    if (marketingPlanId === "pro") {
      handleContactEnterprise();
      return;
    }

    if (marketingPlanId === "free" && currentPlan !== "free") {
      setLoadingPlan(marketingPlanId);
      await openPortal();
      setLoadingPlan(null);
      return;
    }

    if (marketingPlanId === "starter" || marketingPlanId === "growth") {
      setLoadingPlan(marketingPlanId);
      await openUpgradeModal("professional");
      setLoadingPlan(null);
    }
  };

  const canUpgrade = currentPlan === "free";
  const canManageBilling = hasStripeCustomer;
  const canCancelPlan = currentPlan !== "free" && !cancelAtPeriodEnd;

  return (
    <PageShell maxWidth="6xl" className="stripe-billing-page bill-page">
      <PageHeader
        icon={CreditCard}
        title="Your Subscription & Usage"
        description="Transparent pricing. No hidden fees."
      />

      {!paymentsConfigured && !loadingBilling ? (
        <div className="bill-payments-placeholder" role="note">
          <p>{PAYMENTS_NOT_CONFIGURED_COPY}</p>
        </div>
      ) : null}

      {cancelConfirmed || cancelAtPeriodEnd ? (
        <div className="bill-alert bill-alert-success" role="status">
          Your plan cancels at end of billing period
        </div>
      ) : null}

      {checkoutError && !showPaymentModal && !showCancelModal ? (
        <div className="bill-alert bill-alert-error" role="alert">
          {checkoutError}
        </div>
      ) : null}

      <section className="ds-section">
        <BillingCurrentPlan planId={currentPlan} planStatus={planStatus} />

        <div className="bill-action-bar">
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={!canUpgrade || loadingPlan !== null}
            onClick={() => void openUpgradeModal("professional")}
          >
            Upgrade
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={() => {
              document
                .getElementById("bill-plans-heading")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Change Plan
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            disabled={!canManageBilling || loadingPlan !== null}
            onClick={() => void openPortal()}
          >
            Manage Billing
          </button>
          <button
            type="button"
            className="ds-btn bill-btn-danger bill-action-cancel"
            disabled={!canCancelPlan || loadingPlan !== null || cancelLoading}
            onClick={() => {
              setCancelError(null);
              setShowCancelModal(true);
            }}
          >
            Cancel Plan
          </button>
        </div>
      </section>

      <section className="ds-section">
        <BillingUsageSection
          usage={founderUsage}
          loading={loadingBilling}
          interval={interval}
        />
      </section>

      <section className="ds-section" aria-labelledby="bill-plans-heading">
        <div className="bill-plans-header bill-plans-header-sticky">
          <div>
            <h2 id="bill-plans-heading" className="bill-section-title">
              Plans
            </h2>
            <p className="bill-section-desc">
              Choose the plan that matches how many agents and actions you need Wave to protect.
            </p>
          </div>
          <BillingToggle interval={interval} onChange={setInterval} />
        </div>

        <BillingAnnualPricingNote interval={interval} />

        <PlanComparisonTable interval={interval} />

        <BillingPlanCards
          currentPlan={currentPlan}
          onSelectPlan={handleSelectPlan}
          loadingPlan={loadingPlan}
          paymentsConfigured={paymentsConfigured}
          interval={interval}
          upgradeInProgress={loadingPlan !== null}
        />
        <p className="bill-plans-note">
          Checkout uses {interval === "monthly" ? "monthly" : "annual"} billing when you upgrade.
          INR prices shown for India; international checkout may bill in USD.
          {interval === "yearly" ? " Annual plans include a 20% discount." : null}
        </p>
      </section>

      <BillingUpgradeValue />

      <WhyZeltaBillingTeaser />

      <BillingFaqs />

      <section className="ds-section">
        <InvoiceTable invoices={billingData.invoices} />
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

      <CancelBillingModal
        open={showCancelModal}
        loading={cancelLoading}
        error={cancelError}
        onClose={() => {
          setShowCancelModal(false);
          setCancelError(null);
        }}
        onConfirm={(feedback) => {
          void handleCancelSubscription(feedback);
        }}
      />
    </PageShell>
  );
}
