"use client";

import Button from "@/components/ui/Button";
import type { BillingData } from "@/lib/billing-types";
import { isPaymentConfigured } from "@/lib/billing/founder-billing-copy";

interface BillingInfoSectionProps {
  billing: BillingData;
  billingEmail: string | null;
  onUpdateBilling: () => void;
  updating: boolean;
}

export default function BillingInfoSection({
  billing,
  billingEmail,
  onUpdateBilling,
  updating,
}: BillingInfoSectionProps) {
  const paymentConfigured = isPaymentConfigured(
    billing.currentPlan,
    billing.paymentMethod
  );

  const cycleLabel =
    billing.interval === "monthly" ? "Monthly" : "Yearly";

  const nextBilling =
    billing.currentPlan === "free"
      ? "Not applicable on Free plan"
      : new Date(billing.nextBillingDate).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

  return (
    <div className="bill-panel ds-panel p-6">
      <h3 className="bill-section-title">Billing information</h3>
      <p className="bill-section-desc mt-1">
        Payment details and billing cycle for your account.
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="bill-info-row">
          <dt>Payment method</dt>
          <dd>
            {paymentConfigured
              ? `${billing.paymentMethod.brand} ···· ${billing.paymentMethod.last4}`
              : "Not configured"}
          </dd>
        </div>
        <div className="bill-info-row">
          <dt>Billing cycle</dt>
          <dd>{billing.currentPlan === "free" ? "Free plan" : cycleLabel}</dd>
        </div>
        <div className="bill-info-row">
          <dt>Next billing date</dt>
          <dd>{nextBilling}</dd>
        </div>
        <div className="bill-info-row">
          <dt>Billing email</dt>
          <dd>{billingEmail ?? "Not configured"}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <Button
          variant="secondary"
          size="sm"
          loading={updating}
          disabled={!paymentConfigured && billing.currentPlan === "free"}
          onClick={onUpdateBilling}
        >
          Update billing information
        </Button>
        {!paymentConfigured && billing.currentPlan === "free" ? (
          <p className="mt-2 text-xs text-[var(--ds-text-tertiary)]">
            Upgrade to a paid plan to add a payment method.
          </p>
        ) : null}
      </div>
    </div>
  );
}
