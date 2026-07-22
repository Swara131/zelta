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

export function getStripeSecretKey(): string {
  return requireEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function getAppUrl(): string {
  const normalize = (url: string) => url.replace(/\/$/, "");

  const appUrl = optionalEnv("APP_URL") ?? optionalEnv("NEXT_PUBLIC_APP_URL");
  if (appUrl && !appUrl.includes("localhost")) {
    return normalize(appUrl);
  }

  const railwayStaticUrl = optionalEnv("RAILWAY_STATIC_URL");
  if (railwayStaticUrl) {
    return normalize(railwayStaticUrl);
  }

  const railwayDomain = optionalEnv("RAILWAY_PUBLIC_DOMAIN");
  if (railwayDomain) {
    return normalize(`https://${railwayDomain}`);
  }

  return normalize(appUrl ?? "http://localhost:3000");
}

export function getStripePriceId(
  planId: Extract<PlanId, "professional">,
  interval: BillingInterval
): string {
  const key =
    interval === "monthly"
      ? "STRIPE_PRICE_PROFESSIONAL_MONTHLY"
      : "STRIPE_PRICE_PROFESSIONAL_YEARLY";
  return requireEnv(key);
}

/** Maps configured Stripe price IDs back to internal plan + interval. */
export function resolvePlanFromStripePrice(priceId: string): {
  planId: PlanId;
  interval: BillingInterval;
} | null {
  const monthly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_MONTHLY");
  const yearly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_YEARLY");
  const enterpriseMonthly = optionalEnv("STRIPE_PRICE_ENTERPRISE_MONTHLY");
  const enterpriseYearly = optionalEnv("STRIPE_PRICE_ENTERPRISE_YEARLY");

  if (priceId === monthly) {
    return { planId: "professional", interval: "monthly" };
  }
  if (priceId === yearly) {
    return { planId: "professional", interval: "yearly" };
  }
  if (priceId === enterpriseMonthly) {
    return { planId: "enterprise", interval: "monthly" };
  }
  if (priceId === enterpriseYearly) {
    return { planId: "enterprise", interval: "yearly" };
  }

  return null;
}

export function isStripeCheckoutConfigured(interval?: BillingInterval): boolean {
  const secretKey = optionalEnv("STRIPE_SECRET_KEY");
  if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
    return false;
  }

  const monthly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_MONTHLY");
  const yearly = optionalEnv("STRIPE_PRICE_PROFESSIONAL_YEARLY");
  if (interval === "monthly") {
    return !!monthly && monthly.startsWith("price_");
  }
  if (interval === "yearly") {
    return !!yearly && yearly.startsWith("price_");
  }

  return (
    !!monthly &&
    monthly.startsWith("price_") &&
    !!yearly &&
    yearly.startsWith("price_")
  );
}
