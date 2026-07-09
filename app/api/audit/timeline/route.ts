import { AuditLogError } from "@/lib/audit/errors";
import { fetchAuditTimeline } from "@/lib/audit/repository";
import type { AuditAction } from "@/lib/audit/types";
import {
  billingErrorResponse,
  getBillingContext,
  requireFeatureAccess,
} from "@/lib/billing/guards";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import {
  parseSearchParams,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { auditTimelineQuerySchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    const query = parseSearchParams(request.url, auditTimelineQuerySchema);

    const billing = await getBillingContext(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    await requireFeatureAccess(billing, "auditTimeline");

    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const timeline = await fetchAuditTimeline(supabase, {
      organizationId,
      limit: query.limit,
      cursor: query.cursor ?? null,
      action: (query.action as AuditAction | null | undefined) ?? null,
    });

    return secureJson(timeline);
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    if (err instanceof AuditLogError) {
      return secureError(err.message, 500);
    }
    const { status, body } = billingErrorResponse(err);
    if (status !== 500) {
      return secureJson(body, { status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to load audit timeline.";
    return secureError(message, 500);
  }
}
