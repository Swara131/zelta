import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/billing/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await request.json();
  } catch {
    // Optional JSON body is accepted but not persisted.
  }

  try {
    const result = await cancelSubscriptionAtPeriodEnd(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Failed to cancel subscription.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
