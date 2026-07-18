import type { PlanId } from "@/lib/billing-types";
import { isDemoMode } from "./demo-mode";
import {
  hasFeature,
  hasMinimumPlan,
  type PremiumFeature,
} from "./plans";

export const DEMO_ACCESS_PLAN: PlanId = "enterprise";

function resolveDemoMode(explicit?: boolean): boolean {
  if (explicit !== undefined) {
    return explicit;
  }
  // DEMO_MODE is server-only; never infer demo mode in the browser bundle.
  if (typeof window !== "undefined") {
    return false;
  }
  return isDemoMode();
}

/** Plan used for feature and usage-limit checks (does not change stored subscription). */
export function effectiveAccessPlan(storedPlan: PlanId, demoMode?: boolean): PlanId {
  return resolveDemoMode(demoMode) ? DEMO_ACCESS_PLAN : storedPlan;
}

export function canAccessFeature(
  storedPlan: PlanId,
  feature: PremiumFeature,
  demoMode?: boolean
): boolean {
  if (resolveDemoMode(demoMode)) {
    return true;
  }
  return hasFeature(storedPlan, feature);
}

export function canAccessMinimumPlan(
  storedPlan: PlanId,
  requiredPlan: PlanId,
  demoMode?: boolean
): boolean {
  if (resolveDemoMode(demoMode)) {
    return true;
  }
  return hasMinimumPlan(storedPlan, requiredPlan);
}

export function shouldEnforceUsageLimits(demoMode?: boolean): boolean {
  return !resolveDemoMode(demoMode);
}

export function requiredPlanForFeature(feature: PremiumFeature): PlanId {
  return feature === "integrations" ? "enterprise" : "professional";
}
