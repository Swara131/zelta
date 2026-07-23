import type { BillingInterval, PlanId } from "@/lib/billing-types";
import type { PaidPlanId } from "./pricing";

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

export function getStripeSecretKey(): string {
  return requireEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function getAppUrl(): string {
  const normalize = (url: string) => url.replace(/\/$/, "");

  const railwayStaticUrl = optionalEnv("RAILWAY_STATIC_URL");
  if (railwayStaticUrl) {
    return normalize(
      railwayStaticUrl.startsWith("http")
        ? railwayStaticUrl
        : `https://${railwayStaticUrl}`
    );
  }

  const railwayDomain = optionalEnv("RAILWAY_PUBLIC_DOMAIN");
  if (railwayDomain) {
    return normalize(`https://${railwayDomain}`);
  }

  const appUrl = optionalEnv("APP_URL") ?? optionalEnv("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    return normalize(appUrl);
  }

  return "http://localhost:3000";
}

function stripePriceEnvKey(planId: PaidPlanId, interval: BillingInterval): string {
  if (planId === "team") {
    return interval === "monthly"
      ? "STRIPE_PRICE_TEAM_MONTHLY"
      : "STRIPE_PRICE_TEAM_YEARLY";
  }
  return interval === "monthly"
    ? "STRIPE_PRICE_PROFESSIONAL_MONTHLY"
    : "STRIPE_PRICE_PROFESSIONAL_YEARLY";
}

export function getStripePriceId(
  planId: PaidPlanId,
  interval: BillingInterval
): string {
  return requireEnv(stripePriceEnvKey(planId, interval));
}

/** Maps configured Stripe price IDs back to internal plan + interval. */
export function resolvePlanFromStripePrice(priceId: string): {
  planId: PlanId;
  interval: BillingInterval;
} | null {
  const professionalMonthly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_MONTHLY");
  const professionalYearly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_YEARLY");
  const teamMonthly = optionalEnv("STRIPE_PRICE_TEAM_MONTHLY");
  const teamYearly = optionalEnv("STRIPE_PRICE_TEAM_YEARLY");
  const legacyEnterpriseMonthly = optionalEnv("STRIPE_PRICE_ENTERPRISE_MONTHLY");
  const legacyEnterpriseYearly = optionalEnv("STRIPE_PRICE_ENTERPRISE_YEARLY");

  if (priceId === professionalMonthly) {
    return { planId: "professional", interval: "monthly" };
  }
  if (priceId === professionalYearly) {
    return { planId: "professional", interval: "yearly" };
  }
  if (priceId === teamMonthly || priceId === legacyEnterpriseMonthly) {
    return { planId: "team", interval: "monthly" };
  }
  if (priceId === teamYearly || priceId === legacyEnterpriseYearly) {
    return { planId: "team", interval: "yearly" };
  }

  return null;
}

export function isStripeCheckoutConfigured(
  planId: PaidPlanId,
  interval: BillingInterval
): boolean {
  const secretKey = optionalEnv("STRIPE_SECRET_KEY");
  if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
    return false;
  }

  const priceId = optionalEnv(stripePriceEnvKey(planId, interval));
  return !!priceId && priceId.startsWith("price_");
}
