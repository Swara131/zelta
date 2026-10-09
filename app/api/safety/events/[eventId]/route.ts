import { fetchSafetyEventDetail, listOrganizationAgentsForSafety } from "@/lib/safety/center/repository";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const { eventId } = await context.params;
  if (!eventId?.trim()) {
    return secureError("Event ID is required.", 400);
  }

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const agents = await listOrganizationAgentsForSafety(supabase, organizationId);
    const detail = await fetchSafetyEventDetail(supabase, {
      organizationId,
      eventId: eventId.trim(),
      agents,
    });

    if (!detail) {
      return secureError("Safety event not found.", 404);
    }

    return secureJson({ event: detail });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load safety event.";
    return secureError(message, 500);
  }
}
