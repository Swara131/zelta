import { createDecisionAgent, listDecisionAgents } from "@/lib/decision-agents/repository";
import { parseDecisionAgentConfig } from "@/lib/decision-agents/parse-config";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  name: z.string().trim().min(3).max(80),
  purpose: z.string().trim().min(3).max(2000),
  decisionType: z.string().trim().max(64).optional(),
  config: z.record(z.string(), z.unknown()),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const organizationId = await ensureOrganization(
    supabase,
    user.id,
    user.email ?? "user@local"
  );

  try {
    const agents = await listDecisionAgents(supabase, {
      userId: user.id,
      organizationId,
    });
    return secureJson({ success: true, agents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load decision agents.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  try {
    const body = await parseJsonBody(request, createSchema);
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const config = parseDecisionAgentConfig(body.config);
    if (!config) {
      throw new ValidationError("Decision agent config is incomplete.");
    }

    const agent = await createDecisionAgent(supabase, {
      userId: user.id,
      organizationId,
      name: body.name,
      purpose: body.purpose,
      decisionType: body.decisionType ?? "custom",
      config,
    });

    return secureJson({ success: true, agent }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not save decision agent.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
