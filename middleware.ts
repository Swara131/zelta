import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_ROUTE,
  isAuthRoute,
  isProtectedRoute,
  sanitizeRedirect,
} from "@/lib/auth/routes";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { applySecurityHeaders } from "@/lib/security/headers";
import { RateLimitError } from "@/lib/security/errors";
import {
  enforceRateLimit,
  getClientIp,
  getRateLimitForPath,
  rateLimitKey,
} from "@/lib/security/rate-limit";
import {
  isApiRoute,
  isCronApiRoute,
  isGatewayAgentApiRoute,
  isPublicApiRoute,
  requiresApiAuth,
} from "@/lib/security/routes";
import { isCronAuthorizedSecure } from "@/lib/security/env";
import { isOnboardingComplete } from "@/lib/onboarding/onboarding-status";

function jsonResponse(body: Record<string, unknown>, status: number): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(body, { status })
  ) as NextResponse;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isApiRoute(pathname)) {
    const ip = getClientIp(request);
    try {
      enforceRateLimit(
        rateLimitKey(ip, pathname),
        getRateLimitForPath(pathname)
      );
    } catch (err) {
      if (err instanceof RateLimitError) {
        return jsonResponse(
          { error: err.message, code: "rate_limit_exceeded" },
          429
        );
      }
      throw err;
    }
  }

  const { supabase, supabaseResponse } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (requiresApiAuth(pathname) && !user) {
    if (isCronApiRoute(pathname) && isCronAuthorizedSecure(request)) {
      return applySecurityHeaders(supabaseResponse);
    }
    return jsonResponse({ error: "Unauthorized", code: "auth_required" }, 401);
  }

  if (isPublicApiRoute(pathname) || isGatewayAgentApiRoute(pathname)) {
    return applySecurityHeaders(supabaseResponse);
  }

  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthRoute(pathname) && user) {
    const redirectTo = sanitizeRedirect(
      request.nextUrl.searchParams.get("redirectTo")
    );
    const url = request.nextUrl.clone();
    url.pathname = redirectTo || DASHBOARD_ROUTE;
    url.search = "";

    try {
      const { data: profile } = await supabase
        .from("users")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!isOnboardingComplete(user, profile) && !redirectTo) {
        url.pathname = "/onboarding/welcome";
      }
    } catch {
      /* fall through to dashboard */
    }

    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if (
    user &&
    isProtectedRoute(pathname) &&
    !pathname.startsWith("/onboarding/welcome") &&
    pathname !== "/api/onboarding"
  ) {
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!isOnboardingComplete(user, profile)) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = "/onboarding/welcome";
        onboardingUrl.search = "";
        return applySecurityHeaders(NextResponse.redirect(onboardingUrl));
      }
    } catch {
      /* columns may not exist before migration */
    }
  }

  if (pathname === "/auth/reset-password" && !user) {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "reset_link_invalid");
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
