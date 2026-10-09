import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { deployAgentPlatform, buildDeployProgress } from "@/lib/agents/platform/deploy-agent";
import { readPlatformLifecycle } from "@/lib/agents/platform/lifecycle-store";
import { isAgentReadyToDeploy } from "@/lib/agents/platform/verify-agent";
import { getAgentRequirements, snapshotFromBuilderAgent } from "@/lib/agents/requirements";
import { RequirementsNotReadyError } from "@/lib/agents/requirements/errors";
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
  const normalizedSlug = slug?.trim() ?? "";
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: normalizedSlug,
  });
  if (!agent) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  const lifecycle = readPlatformLifecycle(agent.safetySettings);
  const requirements = getAgentRequirements(snapshotFromBuilderAgent(agent, { stage: "deploy" }));
  if (!isAgentReadyToDeploy(lifecycle) || !requirements.ready) {
    return secureJson(
      {
        success: false,
        error: "This agent isn't ready for deployment.",
        lifecycle,
        missing: requirements.missing,
        issues: lifecycle.checks.filter((check) => check.status === "fail"),
      },
      { status: 400 }
    );
  }

  try {
    const result = await deployAgentPlatform(supabase, {
      agent,
      userId: user.id,
      userEmail: user.email ?? "user@local",
    });

    return secureJson({
      success: true,
      slug: result.slug,
      lifecycle: result.lifecycle,
      progress: buildDeployProgress(result.lifecycle.deployment.state),
    });
  } catch (err) {
    if (err instanceof RequirementsNotReadyError) {
      return secureJson(
        { success: false, error: err.message, missing: err.missing },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Deployment failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });
  if (!agent) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  const lifecycle = readPlatformLifecycle(agent.safetySettings);
  return secureJson({
    success: true,
    lifecycle,
    progress: buildDeployProgress(lifecycle.deployment.state),
    readyToDeploy: isAgentReadyToDeploy(lifecycle),
  });
}
