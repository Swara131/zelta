import type { BillingInterval, PlanId, UsageMetric } from "@/lib/billing-types";

export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  professional: 1,
  enterprise: 2,
};

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  professional: "Professional",
  enterprise: "Enterprise",
};

export type PremiumFeature =
  | "translator"
  | "advancedRisk"
  | "analytics"
  | "auditTimeline"
  | "integrations";

export const PLAN_FEATURES: Record<
  PlanId,
  Record<PremiumFeature, boolean>
> = {
  free: {
    translator: false,
    advancedRisk: false,
    analytics: false,
    auditTimeline: false,
    integrations: false,
  },
  professional: {
    translator: true,
    advancedRisk: true,
    analytics: true,
    auditTimeline: true,
    integrations: false,
  },
  enterprise: {
    translator: true,
    advancedRisk: true,
    analytics: true,
    auditTimeline: true,
    integrations: true,
  },
};

export interface PlanLimits {
  apiCalls: number;
  storageMb: number;
  users: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { apiCalls: 1_000, storageMb: 500, users: 3 },
  professional: { apiCalls: 50_000, storageMb: 25_000, users: 25 },
  enterprise: { apiCalls: 999_999_999, storageMb: 999_999_999, users: 999_999 },
};

export function hasMinimumPlan(current: PlanId, required: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function hasFeature(plan: PlanId, feature: PremiumFeature): boolean {
  return PLAN_FEATURES[plan][feature];
}

export function buildUsageMetrics(
  plan: PlanId,
  used: { apiCalls: number; storageMb: number; users: number }
): UsageMetric[] {
  const limits = PLAN_LIMITS[plan];

  if (plan === "enterprise") {
    return [
      { label: "API Calls", used: used.apiCalls, limit: 999_999, unit: "calls" },
      { label: "Storage", used: used.storageMb / 1024, limit: 999_999, unit: "GB" },
      { label: "Users", used: used.users, limit: 999_999, unit: "seats" },
    ];
  }

  if (plan === "professional") {
    return [
      { label: "API Calls", used: used.apiCalls, limit: limits.apiCalls, unit: "calls" },
      {
        label: "Storage",
        used: Math.round((used.storageMb / 1024) * 10) / 10,
        limit: limits.storageMb / 1024,
        unit: "GB",
      },
      { label: "Users", used: used.users, limit: limits.users, unit: "seats" },
    ];
  }

  return [
    { label: "API Calls", used: used.apiCalls, limit: limits.apiCalls, unit: "calls" },
    { label: "Storage", used: used.storageMb, limit: limits.storageMb, unit: "MB" },
    { label: "Users", used: used.users, limit: limits.users, unit: "seats" },
  ];
}

export function isPaidPlan(plan: PlanId): boolean {
  return plan !== "free";
}

export function billingIntervalLabel(interval: BillingInterval): string {
  return interval === "monthly" ? "monthly" : "yearly";
}
