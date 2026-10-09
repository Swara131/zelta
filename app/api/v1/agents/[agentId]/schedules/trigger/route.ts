import { runAgentEngine } from "@/lib/agents/runtime/engine";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { secureError, secureJson } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

/**
 * Manually trigger a scheduled-style run for one agent (dev / testing).
 * Does not require waiting for next_run_at.
 */
export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureError("Agent ID is required.", 400);
  }

  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: normalizedSlug,
  });

  if (!agent) {
    return secureJson({ error: "Agent not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const userEmail = user.email?.trim() || "scheduled@zelta.local";

  console.log(`[scheduler] manual trigger agent ${agent.id} (${normalizedSlug})`);

  try {
    const result = await runAgentEngine(admin, {
      agentDbId: agent.id,
      userId: user.id,
      userEmail,
      task: "Manual scheduled test run",
      mode: "scheduled",
      triggerSource: "manual:schedule-trigger",
    });

    return secureJson({
      success: result.status !== "failed",
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Manual trigger failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
