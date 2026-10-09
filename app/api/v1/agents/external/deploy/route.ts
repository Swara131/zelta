import { deployExternalAgent } from "@/lib/agents/external/deploy-external-agent";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const deploySchema = z.object({
  slug: z.string().trim().min(1),
  environment: z.literal("production").optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  try {
    await ensureOrganization(supabase, user.id, user.email ?? "user@local");
    const body = await parseJsonBody(request, deploySchema);

    const result = await deployExternalAgent(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: body.slug,
      environment: body.environment,
    });

    if (!result.ready) {
      return secureJson({
        success: false,
        ready: false,
        issues: result.issues,
        message: "Agent isn't ready for deployment.",
      });
    }

    return secureJson({
      success: true,
      ready: true,
      slug: result.slug,
      deployedAt: result.deployedAt,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    const message = err instanceof Error ? err.message : "Deployment failed.";
    return secureError(message, 500);
  }
}
