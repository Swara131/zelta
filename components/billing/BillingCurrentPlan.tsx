"use client";

import type { PlanId } from "@/lib/billing-types";
import {
  FOUNDER_PLAN_NAMES,
  type PlanStatusDisplay,
} from "@/lib/billing/founder-billing-copy";

interface BillingCurrentPlanProps {
  planId: PlanId;
  planStatus: PlanStatusDisplay;
}

export default function BillingCurrentPlan({
  planId,
  planStatus,
}: BillingCurrentPlanProps) {
  return (
    <section className="bill-current-plan ds-panel" aria-labelledby="bill-current-plan-heading">
      <p className="bill-kicker">Current plan</p>
      <h2 id="bill-current-plan-heading" className="bill-current-plan-name">
        {FOUNDER_PLAN_NAMES[planId]}
      </h2>

      <dl className="bill-current-meta">
        <div>
          <dt>Status</dt>
          <dd>
            <span
              className={`bill-status-badge ${planStatus.hasPaidSubscription ? "bill-status-active" : "bill-status-free"}`}
            >
              {planStatus.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Billing</dt>
          <dd>{planStatus.billing}</dd>
        </div>
        <div>
          <dt>Next billing date</dt>
          <dd>{planStatus.nextBillingDate}</dd>
        </div>
      </dl>
    </section>
  );
}
