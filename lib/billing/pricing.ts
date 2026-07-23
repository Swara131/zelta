import type { BillingInterval, PlanId } from "@/lib/billing-types";

export type PaidPlanId = Extract<PlanId, "professional" | "team">;

export const PLAN_PRICES: Record<
  PaidPlanId,
  { monthly: number; yearly: number }
> = {
  professional: { monthly: 29, yearly: 290 },
  team: { monthly: 99, yearly: 990 },
};

export function getPlanPrice(
  planId: PaidPlanId,
  interval: BillingInterval
): number {
  return interval === "monthly"
    ? PLAN_PRICES[planId].monthly
    : PLAN_PRICES[planId].yearly;
}

export function formatPlanPriceLabel(
  planId: PaidPlanId,
  interval: BillingInterval
): string {
  const amount = getPlanPrice(planId, interval);
  return interval === "monthly" ? `$${amount}/month` : `$${amount}/year`;
}

export function formatPayPalPrice(amount: number): string {
  return amount.toFixed(2);
}

export function isPaidPlanId(planId: PlanId): planId is PaidPlanId {
  return planId === "professional" || planId === "team";
}
