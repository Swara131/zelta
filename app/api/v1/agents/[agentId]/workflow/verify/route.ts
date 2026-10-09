import { verifyAgentWorkflow } from "@/lib/agents/workflow/service";
import { summarizeValidation } from "@/lib/agents/workflow/validate-workflow";
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
    const result = await verifyAgentWorkflow(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    return secureJson({
      success: true,
      validation: result.validation,
      validationSummary: summarizeValidation(result.validation),
      safetyDiff: result.safetyDiff,
      state: result.state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
