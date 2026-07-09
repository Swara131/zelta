import type { SupabaseClient } from "@supabase/supabase-js";
import { LogUploadError } from "@/lib/storage/errors";
import { ensureUserProfile } from "@/lib/users/ensure-user-profile";

/**
 * Returns the user's organization ID, creating a personal workspace on first use.
 * Relies on `organizations_bootstrap_owner` trigger for membership + subscription.
 */
export async function ensureOrganization(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<string> {
  await ensureUserProfile(supabase, {
    id: userId,
    email: userEmail,
    user_metadata: {},
  });

  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    throw new LogUploadError(memberError.message);
  }

  if (membership?.organization_id) {
    return membership.organization_id;
  }

  const localPart = userEmail.split("@")[0] ?? "user";
  const slugBase =
    localPart
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  const slug = `${slugBase}-${userId.replace(/-/g, "").slice(0, 8)}`;
  const orgName = `${slugBase.charAt(0).toUpperCase()}${slugBase.slice(1)}'s Workspace`;

  const { data: bootstrappedOrgId, error: bootstrapError } = await supabase.rpc(
    "bootstrap_user_organization",
    { org_name: orgName, org_slug: slug }
  );

  if (!bootstrapError && bootstrappedOrgId) {
    return bootstrappedOrgId as string;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug,
    })
    .select("id")
    .single();

  if (orgError) {
    const { data: retry, error: retryError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (retryError) {
      throw new LogUploadError(retryError.message);
    }

    if (retry?.organization_id) {
      return retry.organization_id;
    }

    const hint = orgError.message.includes("row-level security")
      ? `${orgError.message} Run migration 20260704150000_bootstrap_user_organization.sql in Supabase SQL Editor.`
      : orgError.message;
    throw new LogUploadError(hint);
  }

  return org.id;
}
