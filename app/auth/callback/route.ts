import { NextResponse } from "next/server";
import { DASHBOARD_ROUTE, sanitizeRedirect } from "@/lib/auth/routes";
import { recordAudit } from "@/lib/audit/logger";
import { resolveOrganizationId } from "@/lib/translations/repository";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/users/ensure-user-profile";

/**
 * OAuth and email-confirmation callback.
 * Exchanges `code` for a session, then redirects to dashboard (or `next`).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirect(searchParams.get("next") ?? DASHBOARD_ROUTE);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          await ensureUserProfile(supabase, user);
          const organizationId = await resolveOrganizationId(
            supabase,
            user.id,
            user.email ?? "user@local"
          );
          await recordAudit(supabase, {
            request,
            userId: user.id,
            organizationId,
            action: "login",
            entityType: "session",
            entityId: user.id,
            metadata: {
              description: `User signed in (${user.email ?? "unknown"})`,
            },
          });
        } catch (auditErr) {
          console.error("Login audit failed:", auditErr);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
