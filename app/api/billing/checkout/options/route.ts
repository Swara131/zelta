import { isStripeCheckoutConfigured } from "@/lib/billing/env";
import { isPaidPlanId } from "@/lib/billing/pricing";
import { isPayPalCheckoutConfigured } from "@/lib/paypal/env";
import { secureError, secureJson } from "@/lib/security/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intervalParam = url.searchParams.get("interval");
  const planParam = url.searchParams.get("plan");
  const interval =
    intervalParam === "yearly" ? ("yearly" as const) : ("monthly" as const);
  const planId = planParam === "team" ? ("team" as const) : ("professional" as const);

  if (!isPaidPlanId(planId)) {
    return secureError("Invalid plan.", 400);
  }

  return secureJson({
    planId,
    interval,
    providers: {
      stripe: isStripeCheckoutConfigured(planId, interval),
      paypal: isPayPalCheckoutConfigured(planId, interval),
    },
  });
}
