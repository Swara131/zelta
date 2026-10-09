import { publishAgentWorkflow } from "@/lib/agents/workflow/service";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureJson({ success: false, error: "Agent ID is required." }, { status: 400 });
  }

  try {
    const result = await publishAgentWorkflow(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    return secureJson({
      success: true,
      slug: result.slug,
      publishedAt: result.publishedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not publish workflow.";
    return secureJson({ success: false, error: message }, { status: 400 });
  }
}
