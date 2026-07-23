import type { PlanId } from "@/lib/billing-types";

/** Legacy DB enum value kept for existing subscriptions. */
export type StoredPlanId = PlanId | "enterprise";

export function normalizePlanId(plan: StoredPlanId | string): PlanId {
  if (plan === "enterprise") {
    return "team";
  }
  if (plan === "free" || plan === "professional" || plan === "team") {
    return plan;
  }
  return "free";
}

export function isStoredPlanId(value: string): value is StoredPlanId {
  return (
    value === "free" ||
    value === "professional" ||
    value === "team" ||
    value === "enterprise"
  );
}
