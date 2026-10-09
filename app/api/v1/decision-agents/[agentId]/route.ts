import { getDecisionAgentBySlug, updateDecisionAgent } from "@/lib/decision-agents/repository";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const patchSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
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

  if (!agent) return secureJson({ success: false, error: "Not found." }, { status: 404 });
  return secureJson({ success: true, agent });
}

export async function PUT(request: Request, context: RouteContext) {
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

  const existing = await getDecisionAgentBySlug(supabase, {
    organizationId,
    slug: slug?.trim() ?? "",
    userId: user.id,
  });
  if (!existing) return secureJson({ success: false, error: "Not found." }, { status: 404 });

  const body = await parseJsonBody(request, patchSchema);
  const agent = await updateDecisionAgent(supabase, {
    id: existing.id,
    userId: user.id,
    patch: {
      config: body.config as typeof existing.config | undefined,
      status: body.status,
    },
  });

  return secureJson({ success: true, agent });
}
