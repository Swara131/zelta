import { resolveAgentSourceBadge } from "@/lib/agents/external/resolve-agent-source";
import { mapUnknownAgentRow } from "@/lib/agents/runtime-mappers";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const sources: Record<
      string,
      { origin: string; label: string; slug: string; connectionVerified: boolean }
    > = {};

    for (const row of data ?? []) {
      const agent = mapUnknownAgentRow(row);
      if (!agent) continue;
      const badge = resolveAgentSourceBadge(agent);
      if (!badge) continue;
      sources[agent.slug] = {
        origin: badge.origin,
        label: badge.label,
        slug: agent.slug,
        connectionVerified: Boolean(
          agent.safetySettings.externalConnection?.connectionVerifiedAt
        ),
      };
    }

    return secureJson({ success: true, organizationId, sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load agent sources.";
    return secureError(message, 500);
  }
}
