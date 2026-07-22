import { isStripeCheckoutConfigured } from "@/lib/billing/env";
import { isPayPalCheckoutConfigured } from "@/lib/paypal/env";
import { secureJson } from "@/lib/security/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intervalParam = url.searchParams.get("interval");
  const interval =
    intervalParam === "yearly" ? ("yearly" as const) : ("monthly" as const);

  return secureJson({
    interval,
    providers: {
      stripe: isStripeCheckoutConfigured(interval),
      paypal: isPayPalCheckoutConfigured(interval),
    },
  });
}
