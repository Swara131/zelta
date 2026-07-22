import type { BillingInterval, PlanId } from "@/lib/billing-types";
import { BillingError } from "@/lib/billing/errors";

function sanitizeEnvValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return sanitizeEnvValue(value);
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value?.trim()) return undefined;
  return sanitizeEnvValue(value);
}

/** PayPal billing plan IDs are exactly 26 characters: P- + 24 alphanumerics. */
export const PAYPAL_PLAN_ID_PATTERN = /^P-[A-Z0-9]{24}$/;

export type PayPalEnvironment = "sandbox" | "live";

export function isValidPayPalPlanId(planId: string | undefined): boolean {
  if (!planId) return false;
  return PAYPAL_PLAN_ID_PATTERN.test(sanitizeEnvValue(planId));
}

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

export function getPayPalPlanId(interval: BillingInterval): string {
  const key =
    interval === "monthly"
      ? "PAYPAL_PLAN_PROFESSIONAL_MONTHLY"
      : "PAYPAL_PLAN_PROFESSIONAL_YEARLY";
  const planId = requireEnv(key);

  if (!isValidPayPalPlanId(planId)) {
    throw new BillingError(
      `Invalid ${key}. Use the 26-character Plan ID from PayPal (starts with P-, not PROD- or your webhook ID). Run npm run paypal:create-plans and copy the printed P-... values to Railway.`
    );
  }

  return planId;
}

export function getPayPalPlanIdOptional(
  interval: BillingInterval
): string | undefined {
  const planId =
    interval === "monthly"
      ? optionalEnv("PAYPAL_PLAN_PROFESSIONAL_MONTHLY")
      : optionalEnv("PAYPAL_PLAN_PROFESSIONAL_YEARLY");

  return isValidPayPalPlanId(planId) ? planId : undefined;
}

export function isPayPalCheckoutConfigured(
  interval?: BillingInterval
): boolean {
  if (!optionalEnv("PAYPAL_CLIENT_ID") || !optionalEnv("PAYPAL_CLIENT_SECRET")) {
    return false;
  }
  if (interval) {
    return !!getPayPalPlanIdOptional(interval);
  }
  return (
    !!getPayPalPlanIdOptional("monthly") && !!getPayPalPlanIdOptional("yearly")
  );
}
