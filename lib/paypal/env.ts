import type { BillingInterval, PlanId } from "@/lib/billing-types";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export type PayPalEnvironment = "sandbox" | "live";

export function getPayPalClientId(): string {
  return requireEnv("PAYPAL_CLIENT_ID");
}

export function getPayPalClientSecret(): string {
  return requireEnv("PAYPAL_CLIENT_SECRET");
}

export function getPayPalWebhookId(): string {
  return requireEnv("PAYPAL_WEBHOOK_ID");
}

export function getPayPalEnvironment(): PayPalEnvironment {
  const raw = requireEnv("PAYPAL_ENVIRONMENT").toLowerCase();
  if (raw === "sandbox" || raw === "live" || raw === "production") {
    return raw === "production" ? "live" : (raw as PayPalEnvironment);
  }
  throw new Error(
    "PAYPAL_ENVIRONMENT must be 'sandbox' or 'live' (or 'production')."
  );
}

export function getPayPalApiBaseUrl(): string {
  return getPayPalEnvironment() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

/** Maps configured PayPal plan IDs back to internal plan + interval. */
export function resolvePlanFromPayPalPlan(planId: string): {
  planId: PlanId;
  interval: BillingInterval;
} | null {
  const professionalMonthly = optionalEnv("PAYPAL_PLAN_PROFESSIONAL_MONTHLY");
  const professionalYearly = optionalEnv("PAYPAL_PLAN_PROFESSIONAL_YEARLY");
  const enterpriseMonthly = optionalEnv("PAYPAL_PLAN_ENTERPRISE_MONTHLY");
  const enterpriseYearly = optionalEnv("PAYPAL_PLAN_ENTERPRISE_YEARLY");

  if (planId === professionalMonthly) {
    return { planId: "professional", interval: "monthly" };
  }
  if (planId === professionalYearly) {
    return { planId: "professional", interval: "yearly" };
  }
  if (planId === enterpriseMonthly) {
    return { planId: "enterprise", interval: "monthly" };
  }
  if (planId === enterpriseYearly) {
    return { planId: "enterprise", interval: "yearly" };
  }

  return null;
}
