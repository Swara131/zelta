/** Public API routes that skip session auth (use their own verification). */
export const PUBLIC_API_PREFIXES = [
  "/api/webhooks/",
  "/api/paypal/webhook",
] as const;

/** External agent gateway routes — authenticate via agent API key in route handler. */
export const GATEWAY_AGENT_API_PREFIXES = ["/api/v1/"] as const;

/** Routes that accept cron bearer token instead of user session. */
export const CRON_API_ROUTES = ["/api/notifications/retry"] as const;

export function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isCronApiRoute(pathname: string): boolean {
  return CRON_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isGatewayAgentApiRoute(pathname: string): boolean {
  return GATEWAY_AGENT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function requiresApiAuth(pathname: string): boolean {
  if (!isApiRoute(pathname)) return false;
  if (isPublicApiRoute(pathname)) return false;
  if (isGatewayAgentApiRoute(pathname)) return false;
  return true;
}
