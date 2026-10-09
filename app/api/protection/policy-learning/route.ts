import { NextResponse } from "next/server";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { buildPolicyLearningView } from "@/lib/protection/policy-learning/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const thresholdParam = url.searchParams.get("thresholdInr");
  const currentThresholdInr = thresholdParam ? Number(thresholdParam) : undefined;

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const view = await buildPolicyLearningView(supabase, {
      organizationId,
      currentThresholdInr:
        currentThresholdInr && Number.isFinite(currentThresholdInr)
          ? currentThresholdInr
          : undefined,
    });

    return NextResponse.json({ learning: view });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load policy learning.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
