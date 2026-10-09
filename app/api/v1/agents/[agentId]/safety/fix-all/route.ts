import type { NextRequest } from "next/server";
import {
  AgentNotFoundError,
  enforceSafetyMutationRateLimit,
  requireAgentForSafetyApi,
} from "@/lib/safety/autopilot/api-auth";
import { fixAllRecommendations } from "@/lib/safety/autopilot/service";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;

  try {
    enforceSafetyMutationRateLimit(request, "safety-fix-all", user.id);
    const agent = await requireAgentForSafetyApi(supabase, user, slug ?? "");
    const snapshot = await fixAllRecommendations(supabase, agent);
    return secureJson({ success: true, ...snapshot });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to apply fixes.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
