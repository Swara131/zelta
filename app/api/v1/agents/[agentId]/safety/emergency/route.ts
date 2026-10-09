import type { NextRequest } from "next/server";
import {
  AgentNotFoundError,
  enforceSafetyMutationRateLimit,
  requireAgentForSafetyApi,
} from "@/lib/safety/autopilot/api-auth";
import { emergencyActionSchema } from "@/lib/safety/autopilot/validation";
import { executeEmergencyAction } from "@/lib/safety/autopilot/service";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { getClientIp } from "@/lib/security/rate-limit";
import { ValidationError } from "@/lib/security/errors";
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
    enforceSafetyMutationRateLimit(request, "safety-emergency", user.id);
    const body = await parseJsonBody(request, emergencyActionSchema);
    const agent = await requireAgentForSafetyApi(supabase, user, slug ?? "");

    const snapshot = await executeEmergencyAction(
      supabase,
      agent,
      body.action,
      user.id,
      getClientIp(request)
    );

    return secureJson({ success: true, ...snapshot });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Emergency action failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
