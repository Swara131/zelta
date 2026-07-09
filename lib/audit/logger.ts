import type { SupabaseClient } from "@supabase/supabase-js";
import { extractRequestContext } from "./context";
import { insertAuditLog } from "./repository";
import type { AuditLogInput } from "./types";

/**
 * Writes an append-only audit record. Failures are logged and never thrown
 * so primary user actions are not blocked by audit persistence errors.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  input: Omit<AuditLogInput, "ipAddress" | "userAgent"> & {
    request?: Request;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const { request, ...rest } = input;
  const ctx = extractRequestContext(request);

  try {
    await insertAuditLog(supabase, {
      ...rest,
      ipAddress: rest.ipAddress ?? ctx.ipAddress,
      userAgent: rest.userAgent ?? ctx.userAgent,
    });
  } catch (err) {
    console.error("[audit] Failed to record action:", rest.action, err);
  }
}

/** Fire-and-forget variant for hot paths (does not await insert). */
export function recordAuditAsync(
  supabase: SupabaseClient,
  input: Parameters<typeof recordAudit>[1]
): void {
  void recordAudit(supabase, input);
}
