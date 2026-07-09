import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { createBillingPortalSession } from "@/lib/billing/service";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = await createBillingPortalSession(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    return NextResponse.json({ url });
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Failed to open billing portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
