import { AgentKeyError } from "@/lib/gateway/errors";
import { revokeAgentApiKeyForOrganization } from "@/lib/gateway/keys/service";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { requireOrganizationAdmin } from "@/lib/organizations/require-org-admin";
import { assertUuid, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    assertUuid(id, "key id");

    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    await requireOrganizationAdmin(supabase, user.id, organizationId);

    const key = await revokeAgentApiKeyForOrganization(supabase, {
      keyId: id,
      organizationId,
    });

    return secureJson({ key });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    if (err instanceof AgentKeyError) {
      const status = err.message.includes("admin")
        ? 403
        : err.message.includes("not found")
          ? 404
          : 500;
      return secureError(err.message, status);
    }
    const message =
      err instanceof Error ? err.message : "Failed to revoke agent API key.";
    return secureError(message, 500);
  }
}
