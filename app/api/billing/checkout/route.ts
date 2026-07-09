import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { createCheckoutSession } from "@/lib/billing/service";
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

  let planId = "professional" as const;
  let interval: "monthly" | "yearly" = "monthly";

  try {
    const body = await parseJsonBody(request, billingCheckoutSchema);
    planId = body.planId;
    interval = body.interval;
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    /* defaults */
  }

  if (planId !== "professional") {
    return secureError(
      "Only the Professional plan is available for self-serve checkout.",
      400
    );
  }

  try {
    const url = await createCheckoutSession(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      userName: user.user_metadata?.full_name ?? null,
      planId: "professional",
      interval,
    });

    return secureJson({ url });
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Failed to create checkout session.";
    return secureError(message, 500);
  }
}
