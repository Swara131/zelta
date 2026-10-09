import type { BillingInterval, PlanId } from "@/lib/billing-types";
import { PLAN_LIMITS } from "./plans";
import { PLAN_PRICES } from "./pricing";

export const ANNUAL_BILLING_DISCOUNT_PERCENT = 20;

export const ANNUAL_PRICING_BENEFITS = [
  "Annual billing saves you ₹3,000/year",
  "Billing happens once per year",
  "Cancel anytime (refunds prorated)",
] as const;

/** Founder-facing plan names (backend plan IDs unchanged). */
export const FOUNDER_PLAN_NAMES: Record<PlanId, string> = {
  free: "Free",
  professional: "Growth",
  team: "Pro",
};

/** Marketing tier shown on the billing page (maps to backend PlanId for checkout). */
export type MarketingPlanId = "free" | "starter" | "growth" | "pro";

export interface FounderUsageItem {
  label: string;
  used: number;
  limit: number;
  explanation: string;
  helperText: string;
  showProgressBar: boolean;
}

export interface SaaSPlanDefinition {
  id: MarketingPlanId;
  backendPlanId: PlanId;
  name: string;
  tagline: string;
  trustNote: string;
  monthlyPrice: number | null;
  monthlyPriceInr: number | null;
  annualPrice: number | null;
  agentLimit: string;
  actionsMonitored: string;
  approvalChannels: string;
  supportLevel: string;
  approvalWorkflows: boolean;
  auditLogs: boolean;
  riskAnalysis: boolean;
  developerApi: boolean;
  featured?: boolean;
}

export interface PlanStatusDisplay {
  status: string;
  billing: string;
  nextBillingDate: string;
  hasPaidSubscription: boolean;
}

export interface PlanComparisonRow {
  feature: string;
  free: string;
  starter: string;
  growth: string;
  pro: string;
}

export const SAAS_PLANS: SaaSPlanDefinition[] = [
  {
    id: "free",
    backendPlanId: "free",
    name: "FREE",
    tagline: "Try Wave with one protected agent",
    trustNote: "Perfect for learning",
    monthlyPrice: 0,
    monthlyPriceInr: 0,
    annualPrice: 0,
    agentLimit: "1 agent",
    actionsMonitored: "1,000 / month",
    approvalChannels: "Email",
    supportLevel: "Community",
    approvalWorkflows: true,
    auditLogs: false,
    riskAnalysis: false,
    developerApi: false,
  },
  {
    id: "starter",
    backendPlanId: "professional",
    name: "STARTER",
    tagline: "Protect a small fleet of agents",
    trustNote: "Most teams start here",
    monthlyPrice: PLAN_PRICES.professional.monthly,
    monthlyPriceInr: 3_000,
    annualPrice: PLAN_PRICES.professional.yearly,
    agentLimit: "3 agents",
    actionsMonitored: "5,000 / month",
    approvalChannels: "Email",
    supportLevel: "Email support",
    approvalWorkflows: true,
    auditLogs: true,
    riskAnalysis: true,
    developerApi: true,
    featured: true,
  },
  {
    id: "growth",
    backendPlanId: "professional",
    name: "GROWTH",
    tagline: "Scale protection across your team",
    trustNote: "For scaling teams (WhatsApp approvals included)",
    monthlyPrice: PLAN_PRICES.professional.monthly,
    monthlyPriceInr: 9_000,
    annualPrice: PLAN_PRICES.professional.yearly,
    agentLimit: "10 agents",
    actionsMonitored: "50,000 / month",
    approvalChannels: "Email + WhatsApp",
    supportLevel: "Priority support",
    approvalWorkflows: true,
    auditLogs: true,
    riskAnalysis: true,
    developerApi: true,
  },
  {
    id: "pro",
    backendPlanId: "team",
    name: "PRO",
    tagline: "Enterprise-grade control and SLAs",
    trustNote: "Enterprise needs (custom SLAs, dedicated support)",
    monthlyPrice: PLAN_PRICES.team.monthly,
    monthlyPriceInr: null,
    annualPrice: PLAN_PRICES.team.yearly,
    agentLimit: "Unlimited agents",
    actionsMonitored: "250,000+ / month",
    approvalChannels: "All channels + SSO",
    supportLevel: "Dedicated support",
    approvalWorkflows: true,
    auditLogs: true,
    riskAnalysis: true,
    developerApi: true,
  },
];

/** Display limits for founder billing usage meters (by backend plan). */
export const PLAN_USAGE_LIMITS: Record<
  PlanId,
  { agents: number; actions: number; approvals: number }
> = {
  free: { agents: 1, actions: PLAN_LIMITS.free.apiCalls, approvals: 100 },
  professional: {
    agents: 10,
    actions: PLAN_LIMITS.professional.apiCalls,
    approvals: 2_000,
  },
  team: { agents: 999, actions: PLAN_LIMITS.team.apiCalls, approvals: 10_000 },
};

export const BILLING_UPGRADE_VALUE = {
  roi: "Starter plan pays for itself when it prevents one ₹50k mistake",
  metric: "Average customer saves 6 hours/month on approvals",
} as const;

export const BILLING_FAQ_ITEMS = [
  "No contract required. Cancel anytime.",
  "All plans include a 30-day free trial",
  "Need a custom plan? Email sales@zelta.com",
] as const;

export const USAGE_DASHBOARD_INCLUDED = [
  "All usage metrics tracked in real-time",
  "No surprise charges or overages",
  "Usage resets monthly on billing date",
  "Downgrade or upgrade anytime",
] as const;

export type UsageMetricKind = "actions" | "agents" | "approvals";

export const PLAN_COMPARISON_ROWS: PlanComparisonRow[] = [
  {
    feature: "Agents allowed",
    free: "1",
    starter: "3",
    growth: "10",
    pro: "Unlimited",
  },
  {
    feature: "Actions / month",
    free: "1,000",
    starter: "5,000",
    growth: "50,000",
    pro: "250,000+",
  },
  {
    feature: "Approval channels",
    free: "Email",
    starter: "Email",
    growth: "Email + WhatsApp",
    pro: "All channels + SSO",
  },
  {
    feature: "Support",
    free: "Community",
    starter: "Email support",
    growth: "Priority support",
    pro: "Dedicated support",
  },
  {
    feature: "Audit logs",
    free: "—",
    starter: "Included",
    growth: "Included",
    pro: "Included",
  },
  {
    feature: "Risk analysis",
    free: "—",
    starter: "Included",
    growth: "Included",
    pro: "Included",
  },
];

export function marketingPlanFromBackend(planId: PlanId): MarketingPlanId {
  if (planId === "free") return "free";
  if (planId === "team") return "pro";
  return "growth";
}

export function backendPlanForMarketing(marketingId: MarketingPlanId): PlanId {
  const plan = SAAS_PLANS.find((entry) => entry.id === marketingId);
  return plan?.backendPlanId ?? "free";
}

export function formatBillingPrice(amount: number | null): string {
  if (amount == null) return "Custom";
  if (amount === 0) return "$0";
  return `$${amount}`;
}

export function formatBillingPriceInr(amount: number | null): string | null {
  if (amount == null || amount === 0) return amount === 0 ? "₹0" : null;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatPlanDisplayPrice(
  plan: SaaSPlanDefinition,
  interval: BillingInterval = "monthly"
): string {
  if (plan.id === "pro" && plan.monthlyPriceInr == null) {
    return "Custom pricing";
  }

  if (interval === "yearly") {
    if (plan.monthlyPriceInr != null && plan.monthlyPriceInr > 0) {
      const annualInr = plan.monthlyPriceInr * 12;
      return `${formatBillingPriceInr(annualInr)} / year`;
    }
    if (plan.annualPrice != null && plan.annualPrice > 0) {
      return `${formatBillingPrice(plan.annualPrice)} / year`;
    }
    if (plan.monthlyPriceInr === 0) {
      return "₹0 / year";
    }
  }

  if (plan.monthlyPriceInr != null && plan.monthlyPriceInr >= 0) {
    return `${formatBillingPriceInr(plan.monthlyPriceInr)} / month`;
  }
  return `${formatBillingPrice(plan.monthlyPrice)} / month`;
}

export function scaleLimitForInterval(
  limit: number,
  interval: BillingInterval
): number {
  return interval === "yearly" ? limit * 12 : limit;
}

export function formatActionsMonitoredForInterval(
  monthlyLabel: string,
  interval: BillingInterval
): string {
  if (interval === "monthly") {
    return monthlyLabel;
  }

  const match = monthlyLabel.match(/^([\d,]+)(\+?)\s*\/\s*month$/i);
  if (match) {
    const base = Number.parseInt(match[1]!.replace(/,/g, ""), 10);
    const suffix = match[2] ?? "";
    return `${(base * 12).toLocaleString("en-IN")}${suffix} / year`;
  }

  return monthlyLabel.replace(/month/gi, "year");
}

export function getPlanComparisonRows(
  interval: BillingInterval = "monthly"
): PlanComparisonRow[] {
  const periodLabel = interval === "yearly" ? "year" : "month";
  const scale = (value: string): string => {
    if (interval === "monthly") return value;
    if (value.includes("+")) {
      const num = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(num)
        ? `${(num * 12).toLocaleString("en-IN")}+`
        : value;
    }
    const num = Number.parseInt(value.replace(/,/g, ""), 10);
    return Number.isFinite(num) ? (num * 12).toLocaleString("en-IN") : value;
  };

  return PLAN_COMPARISON_ROWS.map((row) => {
    if (row.feature.startsWith("Actions")) {
      return {
        ...row,
        feature: `Actions / ${periodLabel}`,
        free: scale(row.free),
        starter: scale(row.starter),
        growth: scale(row.growth),
        pro: scale(row.pro),
      };
    }
    return row;
  });
}

export function usagePeriodLabel(interval: BillingInterval): string {
  return interval === "yearly" ? "year" : "month";
}

export function getPlanStatusDisplay(
  planId: PlanId,
  interval: BillingInterval,
  nextBillingDate: string | null,
  hasStripeCustomer: boolean
): PlanStatusDisplay {
  const hasPaidSubscription = planId !== "free" && hasStripeCustomer;

  if (!hasPaidSubscription) {
    return {
      status: planId === "free" ? "Free plan" : "Not subscribed",
      billing: planId === "free" ? "No billing" : "Not configured",
      nextBillingDate: planId === "free" ? "Not applicable" : "Set up billing to view",
      hasPaidSubscription: false,
    };
  }

  const formattedDate = nextBillingDate
    ? new Date(nextBillingDate).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Contact support";

  return {
    status: "Active",
    billing: interval === "monthly" ? "Monthly" : "Annual",
    nextBillingDate: formattedDate,
    hasPaidSubscription: true,
  };
}

export function mapFounderUsage(
  planId: PlanId,
  actionsUsed: number,
  agentCount: number,
  approvalRequestsUsed: number,
  interval: BillingInterval = "monthly"
): FounderUsageItem[] {
  const limits = PLAN_USAGE_LIMITS[planId];
  const actionsLimit = scaleLimitForInterval(limits.actions, interval);
  const approvalsLimit = scaleLimitForInterval(limits.approvals, interval);
  const period = usagePeriodLabel(interval);
  const actionsRemaining = Math.max(actionsLimit - actionsUsed, 0);

  const agentHelper =
    agentCount >= limits.agents
      ? "Upgrade to Growth plan to unlock 10 agents"
      : `${Math.max(limits.agents - agentCount, 0)} agent slot${limits.agents - agentCount === 1 ? "" : "s"} available on your plan`;

  return [
    {
      label: "Actions monitored",
      used: actionsUsed,
      limit: actionsLimit,
      explanation:
        "Agent actions Wave checked against your protection rules this billing period.",
      helperText: `You have ${actionsRemaining.toLocaleString()} actions remaining this ${period}`,
      showProgressBar: true,
    },
    {
      label: "Agents",
      used: agentCount,
      limit: limits.agents,
      explanation: "AI agents connected to Wave and sending actions for protection.",
      helperText: agentHelper,
      showProgressBar: true,
    },
    {
      label: "Approval requests",
      used: approvalRequestsUsed,
      limit: approvalsLimit,
      explanation:
        "Times an action was paused and sent for human approval this billing period.",
      helperText:
        interval === "yearly"
          ? "Low usage = predictable annual cost"
          : "Low usage = low monthly cost",
      showProgressBar: true,
    },
  ];
}

export function countApprovalRequestsFromAudit(
  entries: Array<{ runtimeEvent?: string | null }>
): number {
  return entries.filter((entry) => {
    const event = entry.runtimeEvent ?? "";
    return (
      event === "policy.review" ||
      event === "approval.approved" ||
      event === "approval.rejected"
    );
  }).length;
}

export const PAYMENTS_NOT_CONFIGURED_COPY =
  "Online checkout is not configured for this workspace yet. You can review plans and usage here — contact us or ask your admin to enable Stripe billing when you are ready to upgrade.";

export const MANAGE_BILLING_UNAVAILABLE_COPY =
  "Manage Billing opens the Stripe customer portal after you subscribe to a paid plan.";

export function isPaymentConfigured(
  plan: PlanId,
  paymentMethod: { last4: string }
): boolean {
  return plan !== "free" && paymentMethod.last4 !== "0000";
}

/** @deprecated Use SAAS_PLANS — kept for legacy imports */
export function getFounderPlanPrice(
  planId: PlanId,
  monthlyPrice: number | null,
  yearlyPrice: number | null,
  interval: "monthly" | "yearly"
): string {
  if (planId === "free") return "$0 / month";
  const amount = interval === "monthly" ? monthlyPrice : yearlyPrice;
  if (amount == null) return "Custom";
  const suffix = interval === "monthly" ? "month" : "year";
  return `$${amount} / ${suffix}`;
}
