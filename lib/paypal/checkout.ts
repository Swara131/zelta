import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingInterval } from "@/lib/billing-types";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { getAppUrl } from "@/lib/billing/env";
import { BillingError } from "@/lib/billing/errors";
import { paypalApiRequest } from "./client";
import { getPayPalEnvironment, getPayPalPlanId } from "./env";

type PayPalSubscriptionLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalSubscriptionCreateResponse = {
  id: string;
  status: string;
  links?: PayPalSubscriptionLink[];
};

function buildBillingReturnUrl(
  appUrl: string,
  outcome: "success" | "canceled"
): string {
  const url = new URL("/billing", appUrl);
  url.searchParams.set("checkout", outcome);
  url.searchParams.set("provider", "paypal");
  return url.toString();
}

export async function createPayPalCheckoutSession(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    interval: BillingInterval;
  }
): Promise<string> {
  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );

  const planId = getPayPalPlanId(params.interval);
  const appUrl = getAppUrl();
  const environment = getPayPalEnvironment();

  if (environment === "live" && !appUrl.startsWith("https://")) {
    throw new BillingError(
      "PayPal live checkout requires HTTPS return URLs. Set APP_URL=https://zelta-production.up.railway.app on Railway."
    );
  }

  const email = params.userEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BillingError("A valid account email is required for PayPal checkout.");
  }

  const subscription = await paypalApiRequest<PayPalSubscriptionCreateResponse>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      headers: {
        "PayPal-Request-Id": randomUUID(),
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: organizationId.slice(0, 127),
        subscriber: {
          email_address: email,
        },
        application_context: {
          brand_name: "Zelta",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: buildBillingReturnUrl(appUrl, "success"),
          cancel_url: buildBillingReturnUrl(appUrl, "canceled"),
        },
      }),
    }
  );

  const approveUrl = subscription.links?.find((link) => link.rel === "approve")?.href;
  if (!approveUrl) {
    throw new BillingError("PayPal did not return a subscription approval URL.");
  }

  return approveUrl;
}
