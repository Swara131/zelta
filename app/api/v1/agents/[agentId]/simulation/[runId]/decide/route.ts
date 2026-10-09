import { decideSimulationRun, SimulationAuthError } from "@/lib/templates/simulation/service";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ agentId: string; runId: string }>;
}

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId, runId } = await context.params;
  try {
    const body = await parseJsonBody(request, decideSchema);
    const run = await decideSimulationRun(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: agentId?.trim() ?? "",
      runId: runId?.trim() ?? "",
      decision: body.decision,
    });
    return secureJson({ success: true, run });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    if (err instanceof SimulationAuthError) {
      return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Could not decide simulation.";
    return secureJson({ success: false, error: message }, { status: 400 });
  }
}
