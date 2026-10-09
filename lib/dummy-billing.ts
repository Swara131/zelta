import type { Plan, BillingData } from "./billing-types";
import { PLAN_PRICES } from "./billing/pricing";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started protecting your first AI agents.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Current plan",
    features: [
      { text: "1,000 protected actions / month", included: true },
      { text: "Basic agent protection", included: true },
      { text: "Up to 3 team members", included: true },
      { text: "Email notifications", included: true },
      { text: "Human approval workflows", included: true },
      { text: "Full audit history", included: false },
      { text: "Advanced analytics", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "professional",
    name: "Pro",
    description: "For teams protecting more agents and actions every day.",
    monthlyPrice: PLAN_PRICES.professional.monthly,
    yearlyPrice: PLAN_PRICES.professional.yearly,
    popular: true,
    cta: "Upgrade to Pro",
    features: [
      { text: "More AI agents", included: true },
      { text: "50,000 protected actions / month", included: true },
      { text: "Human approval workflows", included: true },
      { text: "Activity and audit history", included: true },
      { text: "Developer / API access", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Advanced protection controls", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "team",
    name: "Business",
    description: "For organizations that need higher limits and advanced controls.",
    monthlyPrice: PLAN_PRICES.team.monthly,
    yearlyPrice: PLAN_PRICES.team.yearly,
    cta: "Contact us",
    features: [
      { text: "Highest agent and action limits", included: true },
      { text: "250,000 protected actions / month", included: true },
      { text: "Advanced protection controls", included: true },
      { text: "More agents and team members", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Integrations and API access", included: true },
      { text: "Priority support", included: true },
      { text: "All Pro features included", included: true },
    ],
  },
];

export const DUMMY_BILLING: BillingData = {
  currentPlan: "free",
  demoMode: false,
  interval: "monthly",
  nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  paymentMethod: {
    brand: "Card",
    last4: "0000",
    expMonth: 1,
    expYear: new Date().getFullYear(),
  },
  usage: [
    { label: "API Calls", used: 0, limit: 1000, unit: "calls" },
    { label: "Storage", used: 0, limit: 500, unit: "MB" },
    { label: "Users", used: 1, limit: 3, unit: "seats" },
  ],
  invoices: [],
};

export const STRIPE_PURPLE = "#635BFF";

export function formatPrice(amount: number | null, interval: "monthly" | "yearly"): string {
  if (amount === null) return "Custom";
  if (amount === 0) return "$0";
  if (interval === "yearly") return `$${amount}`;
  return `$${amount}`;
}

export function getYearlySavings(monthly: number, yearly: number): number {
  return Math.round((1 - yearly / (monthly * 12)) * 100);
}
