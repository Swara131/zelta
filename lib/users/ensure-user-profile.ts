import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Ensures a row exists in public.users for the authenticated auth user.
 * Called after signup/login because the DB trigger may be disabled.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<void> {
  const email =
    user.email?.trim() ||
    `${user.id}@signup.approvalayer.local`;

  const fullName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ||
    (typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null);

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email,
    full_name: fullName,
  });

  if (!insertError) {
    return;
  }

  // Profile already exists — skip (avoid upsert UPDATE path / updated_at trigger issues).
  if (insertError.code === "23505") {
    return;
  }

  throw new Error(`Failed to create user profile: ${insertError.message}`);
}
