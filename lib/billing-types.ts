export type BillingInterval = "monthly" | "yearly";
export type PlanId = "free" | "professional" | "enterprise";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  priceLabel?: string;
  features: PlanFeature[];
  popular?: boolean;
  cta: string;
}

export interface UsageMetric {
  label: string;
  used: number;
  limit: number;
  unit: string;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  plan: string;
  pdfUrl?: string;
}

export interface BillingData {
  currentPlan: PlanId;
  interval: BillingInterval;
  usage: UsageMetric[];
  invoices: Invoice[];
  nextBillingDate: string;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}
