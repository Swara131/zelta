"use client";

import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import {
  formatActionsMonitoredForInterval,
  formatPlanDisplayPrice,
  marketingPlanFromBackend,
  SAAS_PLANS,
  type MarketingPlanId,
  type SaaSPlanDefinition,
} from "@/lib/billing/founder-billing-copy";
import type { BillingInterval, PlanId } from "@/lib/billing-types";

interface BillingPlanCardsProps {
  currentPlan: PlanId;
  onSelectPlan: (planId: MarketingPlanId) => void;
  loadingPlan: MarketingPlanId | PlanId | null;
  paymentsConfigured: boolean;
  interval: BillingInterval;
  upgradeInProgress?: boolean;
}

function AnimatedPlanPrice({
  plan,
  interval,
}: {
  plan: SaaSPlanDefinition;
  interval: BillingInterval;
}) {
  const [animating, setAnimating] = useState(false);
  const price = formatPlanDisplayPrice(plan, interval);

  useEffect(() => {
    setAnimating(true);
    const timer = window.setTimeout(() => setAnimating(false), 320);
    return () => window.clearTimeout(timer);
  }, [interval, plan.id]);

  return (
    <p
      className={`bill-plan-price-main bill-plan-price-animated ${
        animating ? "bill-plan-price-enter" : ""
      }`}
    >
      {price}
    </p>
  );
}

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  loading,
  paymentsConfigured,
  interval,
  upgradeInProgress,
}: {
  plan: SaaSPlanDefinition;
  isCurrent: boolean;
  onSelect: () => void;
  loading: boolean;
  paymentsConfigured: boolean;
  interval: BillingInterval;
  upgradeInProgress: boolean;
}) {
  const isEnterprise = plan.id === "pro";
  const isFree = plan.id === "free";
  const isUpgradeTarget = loading && !isCurrent && !isFree && !isEnterprise;

  const ctaLabel = isCurrent
    ? "Current plan"
    : isFree
      ? "Downgrade via portal"
      : isEnterprise
        ? "Contact sales"
        : isUpgradeTarget
          ? "Setting up your upgrade…"
          : paymentsConfigured
            ? `Upgrade to ${plan.name}`
            : "Upgrade unavailable";

  return (
    <article
      className={`bill-plan-card ds-panel bill-plan-card-interactive ${
        isCurrent ? "bill-plan-card-current" : ""
      } ${isCurrent && upgradeInProgress ? "bill-plan-card-current-highlight" : ""} ${
        plan.featured ? "bill-plan-card-featured" : ""
      }`}
    >
      {isCurrent ? (
        <span className="bill-plan-current-badge bill-plan-current-badge-green">
          CURRENT PLAN
        </span>
      ) : null}

      <header className="bill-plan-card-header">
        <h3 className="bill-plan-card-name">{plan.name}</h3>
        <p className="bill-plan-card-tagline">{plan.tagline}</p>
      </header>

      <AnimatedPlanPrice plan={plan} interval={interval} />
      <p className="bill-plan-trust-note">{plan.trustNote}</p>

      <dl className="bill-plan-features">
        <div>
          <dt>Agents</dt>
          <dd>{plan.agentLimit}</dd>
        </div>
        <div>
          <dt>Actions monitored</dt>
          <dd>{formatActionsMonitoredForInterval(plan.actionsMonitored, interval)}</dd>
        </div>
        <div>
          <dt>Approval channels</dt>
          <dd>{plan.approvalChannels}</dd>
        </div>
        <div>
          <dt>Support</dt>
          <dd>{plan.supportLevel}</dd>
        </div>
      </dl>

      <ul className="bill-plan-checklist" aria-label={`${plan.name} highlights`}>
        <li>
          {plan.approvalWorkflows ? (
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          Human approval workflows
        </li>
        <li>
          {plan.auditLogs ? (
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          Agent activity audit trail
        </li>
        <li>
          {plan.developerApi ? (
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          Gateway API access
        </li>
      </ul>

      <button
        type="button"
        className={`ds-btn w-full ${isCurrent ? "ds-btn-secondary" : "ds-btn-primary"}`}
        disabled={
          isCurrent ||
          loading ||
          (!isEnterprise && !isFree && !paymentsConfigured && !isCurrent)
        }
        onClick={onSelect}
      >
        {ctaLabel}
      </button>
    </article>
  );
}

export default function BillingPlanCards({
  currentPlan,
  onSelectPlan,
  loadingPlan,
  paymentsConfigured,
  interval,
  upgradeInProgress = false,
}: BillingPlanCardsProps) {
  const currentMarketingPlan = marketingPlanFromBackend(currentPlan);

  return (
    <div className="bill-plan-grid bill-plan-grid-four">
      {SAAS_PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isCurrent={plan.id === currentMarketingPlan}
          onSelect={() => onSelectPlan(plan.id)}
          loading={loadingPlan === plan.id}
          paymentsConfigured={paymentsConfigured}
          interval={interval}
          upgradeInProgress={upgradeInProgress}
        />
      ))}
    </div>
  );
}
