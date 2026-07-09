import { NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/errors";
import { getBillingData } from "@/lib/billing/service";
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
    const billing = await getBillingData(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    return NextResponse.json(billing);
  } catch (err) {
    const message =
      err instanceof BillingError ? err.message : "Failed to load billing data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
