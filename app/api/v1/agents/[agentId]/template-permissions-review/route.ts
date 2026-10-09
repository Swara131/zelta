import { updateBuilderAgent } from "@/lib/agents/repository";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { markTemplatePermissionsReviewed } from "@/lib/templates/activation";
import { secureError, secureJson } from "@/lib/security/api";
import {
  enforceRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMIT_STRICT_MAX,
} from "@/lib/security/rate-limit";
import { RateLimitError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;

  try {
    enforceRateLimit(
      rateLimitKey(`${getClientIp(request)}:${user.id}`, "template-permissions-review"),
      RATE_LIMIT_STRICT_MAX
    );

    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: slug?.trim() ?? "",
    });
    if (!agent) {
      return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
    }
    if (!agent.safetySettings.template) {
      return secureJson(
        { success: false, error: "This agent was not created from a template." },
        { status: 400 }
      );
    }

    const updated = await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: {
        safetySettings: markTemplatePermissionsReviewed(agent.safetySettings),
      },
    });

    return secureJson({
      success: true,
      permissionsReviewedAt: updated.safetySettings.template?.permissionsReviewedAt ?? null,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return secureJson({ success: false, error: err.message }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : "Could not save review.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
