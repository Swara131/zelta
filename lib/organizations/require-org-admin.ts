import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentKeyError } from "@/lib/gateway/errors";

export type OrgMemberRole = "owner" | "admin" | "member" | "viewer";

const ADMIN_ROLES = new Set<OrgMemberRole>(["owner", "admin"]);

export async function getOrganizationMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<{ organizationId: string; role: OrgMemberRole } | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new AgentKeyError(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    organizationId: data.organization_id as string,
    role: data.role as OrgMemberRole,
  };
}

export async function requireOrganizationAdmin(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const membership = await getOrganizationMembership(supabase, userId, organizationId);

  if (!membership || !ADMIN_ROLES.has(membership.role)) {
    throw new AgentKeyError("Organization admin access required.");
  }
}
