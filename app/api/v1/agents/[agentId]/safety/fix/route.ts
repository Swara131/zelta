import type { NextRequest } from "next/server";
import {
  AgentNotFoundError,
  enforceSafetyMutationRateLimit,
  requireAgentForSafetyApi,
} from "@/lib/safety/autopilot/api-auth";
import { applyRecommendationFix } from "@/lib/safety/autopilot/service";
import { fixRecommendationSchema } from "@/lib/safety/autopilot/validation";
import { evaluateSafetyPolicy } from "@/lib/safety/autopilot/evaluate-safety-policy";
import {
  jsonToApprovalRules,
  jsonToLimits,
  jsonToPermissions,
  jsonToPolicyRecord,
  readAutopilotJson,
  createDefaultAutopilotPayload,
} from "@/lib/safety/autopilot/json-store";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
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
    enforceSafetyMutationRateLimit(request, "safety-fix", user.id);
    const body = await parseJsonBody(request, fixRecommendationSchema);
    const agent = await requireAgentForSafetyApi(supabase, user, slug ?? "");

    const json =
      readAutopilotJson(agent.safetySettings as Record<string, unknown>) ??
      createDefaultAutopilotPayload(agent);
    const evaluation = evaluateSafetyPolicy({
      policy: jsonToPolicyRecord(agent, json),
      permissions: jsonToPermissions(agent, json),
      approvalRules: jsonToApprovalRules(agent, json),
      limits: jsonToLimits(agent, json),
    });

    const recommendation = evaluation.recommendations.find(
      (r) => r.id === body.recommendationId
    );
    if (!recommendation) {
      return secureJson({ success: false, error: "Recommendation not found." }, { status: 404 });
    }

    const snapshot = await applyRecommendationFix(supabase, agent, recommendation);
    return secureJson({ success: true, ...snapshot });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to apply fix.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
