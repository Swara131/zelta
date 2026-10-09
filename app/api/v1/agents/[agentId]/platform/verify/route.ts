import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { readPlatformLifecycle, writePlatformLifecycle } from "@/lib/agents/platform/lifecycle-store";
import { verifyAgentPlatform, isAgentReadyToDeploy } from "@/lib/agents/platform/verify-agent";
import { updateBuilderAgent } from "@/lib/agents/repository";
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
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });
  if (!agent) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  const lifecycle = await verifyAgentPlatform(supabase, agent);
  await updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId: user.id,
    patch: {
      safetySettings: writePlatformLifecycle(agent.safetySettings, lifecycle),
    },
  });

  return secureJson({
    success: true,
    lifecycle,
    readyToDeploy: isAgentReadyToDeploy(lifecycle),
  });
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
    readyToDeploy: isAgentReadyToDeploy(lifecycle),
  });
}
