import { NextResponse } from "next/server";
import { getAnalyticsDashboard } from "@/lib/analytics/dashboard";
import { AnalyticsError } from "@/lib/analytics/errors";
import {
  billingErrorResponse,
  getBillingContext,
  requireFeatureAccess,
} from "@/lib/billing/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * Full analytics dashboard payload matching AnalyticsData for the UI.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billing = await getBillingContext(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    await requireFeatureAccess(billing, "analytics");

    const data = await getAnalyticsDashboard(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AnalyticsError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const { status, body } = billingErrorResponse(err);
    if (status !== 500) {
      return NextResponse.json(body, { status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to load dashboard analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
