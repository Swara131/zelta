import { NextResponse } from "next/server";
import { ApprovalEngineError } from "@/lib/approvals/errors";
import {
  formatApprovalTimeKpi,
  formatSuccessRateKpi,
  getApprovalDashboardStats,
} from "@/lib/approvals/stats";
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
    const stats = await getApprovalDashboardStats(supabase);

    return NextResponse.json({
      stats,
      kpis: {
        pendingApprovals: stats.pending,
        criticalPending: stats.critical,
        p1Pending: stats.p1,
        approvalTime: formatApprovalTimeKpi(stats.avgResolutionMinutes),
        successRate: formatSuccessRateKpi(stats.successRatePercent),
        autoApproved: stats.autoApproved,
        decisionsToday: stats.decisionsToday,
      },
    });
  } catch (err) {
    const message =
      err instanceof ApprovalEngineError ? err.message : "Failed to load approval stats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
