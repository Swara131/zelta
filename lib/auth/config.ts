/**
 * Auth configuration — dashboard entry point and OAuth callback URLs.
 */

/** Primary app entry after login (Upload Logs dashboard). */
export const DASHBOARD_ROUTE = "/upload";

export function getAuthCallbackUrl(
  redirectPath: string = DASHBOARD_ROUTE,
  origin?: string
): string {
  const path = `/auth/callback?next=${encodeURIComponent(redirectPath)}`;
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : undefined) ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path}`;
}

/** Full callback URL for server-side auth (email signup, password reset). */
export async function getAuthCallbackUrlFromRequest(
  redirectPath: string = DASHBOARD_ROUTE
): Promise<string> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host") ?? undefined;
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;
  return getAuthCallbackUrl(redirectPath, origin);
}
