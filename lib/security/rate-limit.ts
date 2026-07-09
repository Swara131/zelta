import type { NextRequest } from "next/server";
import { RateLimitError } from "./errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

/** Default API rate limit: requests per window per IP+route. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_DEFAULT_MAX = 120;
export const RATE_LIMIT_STRICT_MAX = 30;
export const RATE_LIMIT_WEBHOOK_MAX = 300;

const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export function getClientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Sliding-window rate limiter (in-memory).
 * Suitable for single-instance / dev; use Redis/Upstash for multi-node production.
 */
export function enforceRateLimit(
  key: string,
  maxRequests: number,
  windowMs = RATE_LIMIT_WINDOW_MS
): { remaining: number; resetAt: number } {
  const now = Date.now();
  cleanupExpired(now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { remaining: maxRequests - 1, resetAt };
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new RateLimitError(retryAfterSeconds);
  }

  bucket.count += 1;
  return { remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
}

export function rateLimitKey(ip: string, route: string): string {
  return `${ip}:${route}`;
}

export function getRateLimitForPath(pathname: string): number {
  if (pathname.startsWith("/api/webhooks/")) {
    return RATE_LIMIT_WEBHOOK_MAX;
  }
  if (
    pathname.startsWith("/api/billing/checkout") ||
    pathname.startsWith("/api/translator") ||
    pathname.startsWith("/api/risk") ||
    pathname.startsWith("/api/v1/")
  ) {
    return RATE_LIMIT_STRICT_MAX;
  }
  if (pathname.startsWith("/api/")) {
    return RATE_LIMIT_DEFAULT_MAX;
  }
  return RATE_LIMIT_DEFAULT_MAX;
}
