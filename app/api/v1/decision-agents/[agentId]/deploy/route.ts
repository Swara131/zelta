import { getDecisionAgentBySlug, updateDecisionAgent } from "@/lib/decision-agents/repository";
import { getAgentRequirements, snapshotFromDecisionAgent } from "@/lib/agents/requirements";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
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
  const organizationId = await ensureOrganization(
    supabase,
    user.id,
    user.email ?? "user@local"
  );

  const agent = await getDecisionAgentBySlug(supabase, {
    organizationId,
    slug: slug?.trim() ?? "",
    userId: user.id,
  });

  if (!agent) {
    return secureJson({ success: false, error: "Decision agent not found." }, { status: 404 });
  }

  const requirements = getAgentRequirements(snapshotFromDecisionAgent(agent, { stage: "deploy" }));
  if (!requirements.ready) {
    return secureJson(
      {
        success: false,
        error: "This decision agent isn't ready for deployment.",
        missing: requirements.missing,
      },
      { status: 400 }
    );
  }

  const deployedAt = new Date().toISOString();
  const nextVersion = (agent.deployment?.version ?? 0) + 1;

  const updated = await updateDecisionAgent(supabase, {
    id: agent.id,
    userId: user.id,
    patch: {
      status: "deployed",
      deployment: {
        version: nextVersion,
        state: "deployed",
        deployedAt,
      },
    },
  });

  return secureJson({
    success: true,
    message: "Decision agent deployed successfully.",
    agent: updated,
  });
}
