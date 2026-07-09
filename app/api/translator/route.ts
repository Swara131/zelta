import { NextResponse } from "next/server";
import {
  AiTranslationError,
  translateLogWithGroq,
} from "@/lib/groq/translate-log";
import { RiskDbError, saveTranslatorSession } from "@/lib/risk/repository";
import {
  getTranslationsForUploadedLog,
  readUploadedLogContent,
  resolveOrganizationId,
  saveTranslations,
} from "@/lib/translations/repository";
import { TranslationDbError } from "@/lib/translations/errors";
import { recordAudit } from "@/lib/audit/logger";
import {
  billingErrorResponse,
  getBillingContext,
  requireFeatureAccess,
} from "@/lib/billing/guards";
import { assertUsageCapacity } from "@/lib/billing/usage";
import {
  assertUuid,
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { translatorPostSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

function errorStatus(err: unknown): number {
  if (err instanceof Error && err.message.includes("Missing environment variable")) {
    return 503;
  }
  if (
    err instanceof AiTranslationError &&
    err.message.toLowerCase().includes("rate limit")
  ) {
    return 429;
  }
  if (err instanceof TranslationDbError && err.message.includes("not found")) {
    return 404;
  }
  return 500;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billing = await getBillingContext(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    await requireFeatureAccess(billing, "translator");
    await assertUsageCapacity(
      supabase,
      billing.organizationId,
      billing.subscription,
      "apiCalls"
    );
  } catch (err) {
    const { status, body } = billingErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const uploadedLogId = new URL(request.url).searchParams.get("uploadedLogId");

  if (!uploadedLogId) {
    return NextResponse.json(
      { error: "uploadedLogId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    assertUuid(uploadedLogId, "uploadedLogId");
    const [{ filename, content }, translations] = await Promise.all([
      readUploadedLogContent(supabase, uploadedLogId, user.id),
      getTranslationsForUploadedLog(supabase, uploadedLogId),
    ]);

    return NextResponse.json({
      filename,
      logContent: content,
      translations,
      cached: translations.length > 0,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    const message =
      err instanceof TranslationDbError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to load log.";

    return secureError(message, errorStatus(err));
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const billing = await getBillingContext(
      supabase,
      user.id,
      user.email ?? "user@local"
    );
    await requireFeatureAccess(billing, "translator");
    await assertUsageCapacity(
      supabase,
      billing.organizationId,
      billing.subscription,
      "apiCalls"
    );
  } catch (err) {
    const { status, body } = billingErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  try {
    const body = await parseJsonBody(request, translatorPostSchema);
    let logContent = body.logContent?.trim() ?? "";
    let filename = body.filename ?? null;
    const uploadedLogId = body.uploadedLogId ?? null;
    let organizationId: string | undefined;

    if (uploadedLogId) {
      const uploaded = await readUploadedLogContent(supabase, uploadedLogId, user.id);
      logContent = uploaded.content;
      filename = uploaded.filename;
      organizationId = uploaded.organizationId;
    }

    if (!logContent) {
      return secureError("Provide uploadedLogId or logContent.", 400);
    }

    const aiTranslations = await translateLogWithGroq(logContent);

    const resolvedOrgId = await resolveOrganizationId(
      supabase,
      user.id,
      user.email ?? "user@local",
      organizationId
    );

    const translations = await saveTranslations(supabase, {
      userId: user.id,
      organizationId: resolvedOrgId,
      uploadedLogId,
      translations: aiTranslations,
    });

    try {
      await saveTranslatorSession(
        supabase,
        user.id,
        logContent,
        translations,
        filename
      );
    } catch (dbErr) {
      console.error("Failed to persist legacy translator session:", dbErr);
    }

    await recordAudit(supabase, {
      request,
      userId: user.id,
      organizationId: resolvedOrgId,
      action: "translate",
      entityType: "translations",
      entityId: uploadedLogId,
      metadata: {
        description: filename
          ? `Translated log file "${filename}" (${translations.length} actions)`
          : `Translated log (${translations.length} actions)`,
        filename,
        lineCount: translations.length,
      },
    });

    return secureJson({
      translations,
      filename,
      uploadedLogId,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    const message =
      err instanceof AiTranslationError
        ? err.message
        : err instanceof TranslationDbError
          ? err.message
          : err instanceof RiskDbError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Translation failed.";

    return secureError(message, errorStatus(err));
  }
}
