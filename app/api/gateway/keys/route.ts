import { AgentKeyError } from "@/lib/gateway/errors";
import {
  createAgentApiKey,
  listAgentApiKeys,
} from "@/lib/gateway/keys/service";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { requireOrganizationAdmin } from "@/lib/organizations/require-org-admin";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createAgentApiKeySchema } from "@/lib/security/validation";
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

    const keys = await listAgentApiKeys(supabase, organizationId);
    return secureJson({ keys });
  } catch (err) {
    const message =
      err instanceof AgentKeyError ? err.message : "Failed to list agent API keys.";
    return secureError(message, 500);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    const body = await parseJsonBody(request, createAgentApiKeySchema);
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    await requireOrganizationAdmin(supabase, user.id, organizationId);

    const created = await createAgentApiKey(supabase, {
      organizationId,
      agentId: body.agentId,
      name: body.name,
      createdBy: user.id,
      expiresAt: body.expiresAt ?? null,
    });

    return secureJson(
      {
        key: created.key,
        plainKey: created.plainKey,
        message:
          "Store this API key securely. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    if (err instanceof AgentKeyError) {
      const status = err.message.includes("admin") ? 403 : 500;
      return secureError(err.message, status);
    }
    const message =
      err instanceof Error ? err.message : "Failed to create agent API key.";
    return secureError(message, 500);
  }
}
