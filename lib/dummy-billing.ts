import type { Plan, BillingData } from "./billing-types";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "For individuals exploring agent action monitoring.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Current plan",
    features: [
      { text: "1,000 API calls / month", included: true },
      { text: "500 MB log storage", included: true },
      { text: "Up to 3 users", included: true },
      { text: "Basic risk scoring", included: true },
      { text: "Email notifications", included: true },
      { text: "AI Translator", included: false },
      { text: "SSO & SAML", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "For teams that need full approval workflows and AI analysis.",
    monthlyPrice: 49,
    yearlyPrice: 470,
    popular: true,
    cta: "Upgrade to Professional",
    features: [
      { text: "50,000 API calls / month", included: true },
      { text: "25 GB log storage", included: true },
      { text: "Up to 25 users", included: true },
      { text: "Advanced risk classifier", included: true },
      { text: "Slack, Teams & email alerts", included: true },
      { text: "AI Translator", included: true },
      { text: "Audit timeline & analytics", included: true },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organizations with advanced security and compliance needs.",
    monthlyPrice: null,
    yearlyPrice: null,
    priceLabel: "Custom",
    cta: "Contact sales",
    features: [
      { text: "Unlimited API calls", included: true },
      { text: "Unlimited storage", included: true },
      { text: "Unlimited users", included: true },
      { text: "Custom ML models", included: true },
      { text: "All integrations", included: true },
      { text: "SSO, SAML & SCIM", included: true },
      { text: "Dedicated CSM", included: true },
      { text: "99.99% SLA", included: true },
    ],
  },
];

export const DUMMY_BILLING: BillingData = {
  currentPlan: "free",
  demoMode: false,
  interval: "monthly",
  nextBillingDate: "2026-07-28T00:00:00Z",
  paymentMethod: {
    brand: "Visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2027,
  },
  usage: [
    { label: "API Calls", used: 742, limit: 1000, unit: "calls" },
    { label: "Storage", used: 312, limit: 500, unit: "MB" },
    { label: "Users", used: 2, limit: 3, unit: "seats" },
  ],
  invoices: [
    {
      id: "INV-2026-006",
      date: "2026-06-01T00:00:00Z",
      amount: 0,
      status: "paid",
      plan: "Free",
    },
    {
      id: "INV-2026-005",
      date: "2026-05-01T00:00:00Z",
      amount: 0,
      status: "paid",
      plan: "Free",
    },
    {
      id: "INV-2026-004",
      date: "2026-04-01T00:00:00Z",
      amount: 0,
      status: "paid",
      plan: "Free",
    },
    {
      id: "INV-2026-003",
      date: "2026-03-01T00:00:00Z",
      amount: 49,
      status: "paid",
      plan: "Professional",
    },
    {
      id: "INV-2026-002",
      date: "2026-02-01T00:00:00Z",
      amount: 49,
      status: "paid",
      plan: "Professional",
    },
    {
      id: "INV-2026-001",
      date: "2026-01-01T00:00:00Z",
      amount: 49,
      status: "paid",
      plan: "Professional",
    },
  ],
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
