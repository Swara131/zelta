import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { createPayPalCheckoutSession } from "@/lib/paypal/checkout";
import { isPayPalCheckoutConfigured } from "@/lib/paypal/env";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { billingCheckoutSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let interval: "monthly" | "yearly" = "monthly";

  try {
    const body = await parseJsonBody(request, billingCheckoutSchema);
    interval = body.interval;
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
  }

  if (!user.email?.trim()) {
    return secureError(
      "Your account needs an email address before subscribing with PayPal.",
      400
    );
  }

  if (!isPayPalCheckoutConfigured(interval)) {
    return secureError(
      "PayPal checkout is not configured for this billing interval.",
      503
    );
  }

  try {
    const url = await createPayPalCheckoutSession(supabase, {
      userId: user.id,
      userEmail: user.email.trim(),
      interval,
    });

    return secureJson({ url, provider: "paypal" });
  } catch (err) {
    const message =
      err instanceof BillingError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to create PayPal checkout.";
    console.error("[paypal checkout]", err);
    return secureError(message, 500);
  }
}
