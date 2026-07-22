import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingInterval } from "@/lib/billing-types";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { getAppUrl } from "@/lib/billing/env";
import { BillingError } from "@/lib/billing/errors";
import { paypalApiRequest } from "./client";
import { getPayPalPlanId } from "./env";

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

  const subscription = await paypalApiRequest<PayPalSubscriptionCreateResponse>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        custom_id: organizationId,
        subscriber: {
          email_address: params.userEmail,
        },
        application_context: {
          brand_name: "Zelta",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: `${appUrl}/billing?checkout=success&provider=paypal`,
          cancel_url: `${appUrl}/billing?checkout=canceled&provider=paypal`,
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
