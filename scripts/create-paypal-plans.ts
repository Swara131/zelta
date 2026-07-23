#!/usr/bin/env tsx
/**
 * Create Zelta PayPal products and subscription plans (Professional + Team).
 *
 * Requires in .env.local (or environment):
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_ENVIRONMENT=sandbox|live
 *
 * After success, writes to .env.local:
 *   PAYPAL_PRODUCT_ID
 *   PAYPAL_PLAN_PROFESSIONAL_MONTHLY
 *   PAYPAL_PLAN_PROFESSIONAL_YEARLY
 *   PAYPAL_PLAN_TEAM_MONTHLY
 *   PAYPAL_PLAN_TEAM_YEARLY
 *
 * Usage:
 *   npm run paypal:create-plans
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PLAN_PRICES, formatPayPalPrice } from "@/lib/billing/pricing";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value) {
      process.env[key] = value;
    }
  }
}

function upsertEnvLocal(updates: Record<string, string>): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local — create it before running this script.");
  }

  let content = readFileSync(envPath, "utf8");

  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      content = `${content.trimEnd()}\n${line}\n`;
    }
  }

  writeFileSync(envPath, content, "utf8");
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const REQUIRED_PAYPAL_VARS = [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_ENVIRONMENT",
] as const;

function assertPayPalEnv(): void {
  const missing = REQUIRED_PAYPAL_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;

  console.error("Missing PayPal environment variables in .env.local:\n");
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error("\nAdd them to .env.local, save the file, then re-run:");
  console.error("  npm run paypal:create-plans");
  process.exit(1);
}

assertPayPalEnv();

type PayPalProduct = { id: string; name: string };
type PayPalPlan = { id: string; name: string; status?: string };

const PRODUCT_NAME = "Zelta";

const PLANS = [
  {
    name: "Professional Monthly",
    description: `Zelta Professional — $${PLAN_PRICES.professional.monthly} USD, billed every month`,
    price: formatPayPalPrice(PLAN_PRICES.professional.monthly),
    intervalUnit: "MONTH" as const,
    envKey: "PAYPAL_PLAN_PROFESSIONAL_MONTHLY",
  },
  {
    name: "Professional Yearly",
    description: `Zelta Professional — $${PLAN_PRICES.professional.yearly} USD, billed every year`,
    price: formatPayPalPrice(PLAN_PRICES.professional.yearly),
    intervalUnit: "YEAR" as const,
    envKey: "PAYPAL_PLAN_PROFESSIONAL_YEARLY",
  },
  {
    name: "Team Monthly",
    description: `Zelta Team — $${PLAN_PRICES.team.monthly} USD, billed every month`,
    price: formatPayPalPrice(PLAN_PRICES.team.monthly),
    intervalUnit: "MONTH" as const,
    envKey: "PAYPAL_PLAN_TEAM_MONTHLY",
  },
  {
    name: "Team Yearly",
    description: `Zelta Team — $${PLAN_PRICES.team.yearly} USD, billed every year`,
    price: formatPayPalPrice(PLAN_PRICES.team.yearly),
    intervalUnit: "YEAR" as const,
    envKey: "PAYPAL_PLAN_TEAM_YEARLY",
  },
] as const;

async function main(): Promise<void> {
  const { paypalApiRequest } = await import("@/lib/paypal/client");
  const { getPayPalEnvironment, getPayPalApiBaseUrl } = await import(
    "@/lib/paypal/env"
  );

  console.log(`PayPal environment: ${getPayPalEnvironment()}`);
  console.log(`PayPal API base URL: ${getPayPalApiBaseUrl()}`);
  console.log("");

  const product = await paypalApiRequest<PayPalProduct>("/v1/catalogs/products", {
    method: "POST",
    headers: {
      "PayPal-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      name: PRODUCT_NAME,
      description: "Zelta subscription plans for AI agent approval workflows",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

  const createdPlans: Array<{ name: string; id: string; envKey: string }> = [];

  for (const plan of PLANS) {
    const created = await paypalApiRequest<PayPalPlan>("/v1/billing/plans", {
      method: "POST",
      headers: {
        "PayPal-Request-Id": randomUUID(),
      },
      body: JSON.stringify({
        product_id: product.id,
        name: plan.name,
        description: plan.description,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: plan.intervalUnit,
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: plan.price,
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });

    if (created.status && created.status !== "ACTIVE") {
      await paypalApiRequest(
        `/v1/billing/plans/${encodeURIComponent(created.id)}/activate`,
        {
          method: "POST",
          headers: {
            "PayPal-Request-Id": randomUUID(),
          },
        }
      );
    }

    createdPlans.push({
      name: plan.name,
      id: created.id,
      envKey: plan.envKey,
    });
  }

  const envUpdates: Record<string, string> = {
    PAYPAL_PRODUCT_ID: product.id,
  };
  for (const plan of createdPlans) {
    envUpdates[plan.envKey] = plan.id;
  }

  upsertEnvLocal(envUpdates);

  console.log("=== Created successfully ===");
  console.log(`Product: ${PRODUCT_NAME}`);
  console.log(`Product ID: ${product.id}`);
  console.log("");
  for (const plan of createdPlans) {
    console.log(`${plan.name}`);
    console.log(`Plan ID: ${plan.id}`);
    console.log("");
  }
  console.log("=== Saved to .env.local ===");
  console.log(`PAYPAL_PRODUCT_ID=${product.id}`);
  for (const plan of createdPlans) {
    console.log(`${plan.envKey}=${plan.id}`);
  }
  console.log("");
  console.log("Copy the plan IDs to Railway if deploying remotely.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
