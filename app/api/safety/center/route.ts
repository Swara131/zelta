import { loadSafetyCenter } from "@/lib/safety/center/service";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const payload = await loadSafetyCenter(supabase, organizationId);
    return secureJson(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load Safety Center.";
    return secureError(message, 500);
  }
}
