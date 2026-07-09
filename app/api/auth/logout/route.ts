import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit/logger";
import { resolveOrganizationId } from "@/lib/translations/repository";
import { createClient } from "@/lib/supabase/server";

/** Server-side logout with audit trail (optional — wire from client when ready). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const organizationId = await resolveOrganizationId(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    await recordAudit(supabase, {
      request,
      userId: user.id,
      organizationId,
      action: "logout",
      entityType: "session",
      entityId: user.id,
      metadata: {
        description: `User signed out (${user.email ?? "unknown"})`,
      },
    });

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Logout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
