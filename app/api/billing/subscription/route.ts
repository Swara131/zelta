import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { getSubscriptionSummary } from "@/lib/billing/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getSubscriptionSummary(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    return NextResponse.json(summary);
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Failed to load subscription.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
