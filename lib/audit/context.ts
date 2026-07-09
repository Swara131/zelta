/** Extract client IP and user agent from an incoming HTTP request. */
export function extractRequestContext(request?: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request) {
    return { ipAddress: null, userAgent: null };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null;

  const userAgent = request.headers.get("user-agent");

  return {
    ipAddress,
    userAgent: userAgent ?? null,
  };
}
