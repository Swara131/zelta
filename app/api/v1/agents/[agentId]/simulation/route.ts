import { getAgentSimulationContext, SimulationAuthError, startSimulationRun } from "@/lib/templates/simulation/service";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const startSchema = z.object({
  actionId: z.string().trim().min(1).max(80),
  inputs: z.record(z.string(), z.string().max(4000)).default({}),
});

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId } = await context.params;
  try {
    const ctx = await getAgentSimulationContext(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: agentId?.trim() ?? "",
    });
    return secureJson({
      success: true,
      scenario: ctx.scenario,
      lastRun: ctx.lastRun,
      workspaceId: ctx.workspaceId,
      templateSlug: ctx.templateSlug,
      agentId: ctx.agentId,
    });
  } catch (err) {
    if (err instanceof SimulationAuthError) {
      return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Could not load simulation.";
    const status = message.includes("not found") || message.includes("not linked") ? 404 : 400;
    return secureJson({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId } = await context.params;
  try {
    const body = await parseJsonBody(request, startSchema);
    const run = await startSimulationRun(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: agentId?.trim() ?? "",
      actionId: body.actionId,
      inputs: body.inputs,
    });
    return secureJson({ success: true, run });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    if (err instanceof SimulationAuthError) {
      return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Could not start simulation.";
    return secureJson({ success: false, error: message }, { status: 400 });
  }
}
