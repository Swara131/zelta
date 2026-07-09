import { NextResponse } from "next/server";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { ensureUserProfile } from "@/lib/users/ensure-user-profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Creates public.users + organization on first authenticated request.
 * Safe to call multiple times.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(supabase, user);
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    return NextResponse.json({ ok: true, organizationId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to bootstrap account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
