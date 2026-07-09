import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { getGroqModel } from "@/lib/groq/env";
import { LogUploadError } from "@/lib/storage/errors";
import { LOG_UPLOADS_BUCKET } from "@/lib/storage/constants";
import type { TranslatedAction, UploadedLogSummary } from "@/lib/translator-types";
import { TranslationDbError } from "./errors";

type UploadedLogRow = {
  id: string;
  filename: string;
  storage_path: string;
  organization_id: string;
  user_id: string;
  status: string;
};

type TranslationRow = {
  id: string;
  line_number: number;
  action: string;
  explanation: string;
  affected_system: string;
  affected_user: string;
  event_timestamp: string | null;
  business_impact: TranslatedAction["businessImpact"];
  ai_confidence: number;
};

function parseEventTimestamp(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function mapTranslationRow(row: TranslationRow): TranslatedAction {
  return {
    id: row.id,
    lineNumber: row.line_number,
    action: row.action,
    explanation: row.explanation,
    affectedSystem: row.affected_system,
    affectedUser: row.affected_user,
    timestamp: row.event_timestamp ?? new Date().toISOString(),
    businessImpact: row.business_impact,
    aiConfidence: row.ai_confidence,
  };
}

export async function listUploadedLogsForTranslation(
  supabase: SupabaseClient,
  userId: string
): Promise<UploadedLogSummary[]> {
  const { data: logs, error } = await supabase
    .from("uploaded_logs")
    .select("id, filename, created_at, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new TranslationDbError(error.message);
  }

  if (!logs?.length) {
    return [];
  }

  const logIds = logs.map((log) => log.id);
  const { data: translationRows, error: translationError } = await supabase
    .from("translations")
    .select("uploaded_log_id")
    .in("uploaded_log_id", logIds);

  if (translationError) {
    throw new TranslationDbError(translationError.message);
  }

  const translatedIds = new Set(
    (translationRows ?? [])
      .map((row) => row.uploaded_log_id)
      .filter((id): id is string => typeof id === "string")
  );

  return logs.map((log) => ({
    id: log.id,
    filename: log.filename,
    createdAt: log.created_at,
    hasTranslations: translatedIds.has(log.id),
  }));
}

export async function readUploadedLogContent(
  supabase: SupabaseClient,
  uploadedLogId: string,
  userId: string
): Promise<{ filename: string; content: string; organizationId: string }> {
  const { data: log, error } = await supabase
    .from("uploaded_logs")
    .select("id, filename, storage_path, organization_id, user_id, status")
    .eq("id", uploadedLogId)
    .single();

  if (error || !log) {
    throw new TranslationDbError("Uploaded log not found.");
  }

  const row = log as UploadedLogRow;

  if (row.user_id !== userId) {
    throw new TranslationDbError("You can only translate your own uploads.");
  }

  if (row.status !== "completed") {
    throw new TranslationDbError("This upload is not ready for translation.");
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(LOG_UPLOADS_BUCKET)
    .download(row.storage_path);

  if (downloadError || !blob) {
    throw new TranslationDbError(
      downloadError?.message ?? "Could not read the uploaded log file."
    );
  }

  const content = await blob.text();

  if (!content.trim()) {
    throw new TranslationDbError("The uploaded log file is empty.");
  }

  return {
    filename: row.filename,
    content,
    organizationId: row.organization_id,
  };
}

export async function getTranslationsForUploadedLog(
  supabase: SupabaseClient,
  uploadedLogId: string
): Promise<TranslatedAction[]> {
  const { data, error } = await supabase
    .from("translations")
    .select(
      "id, line_number, action, explanation, affected_system, affected_user, event_timestamp, business_impact, ai_confidence"
    )
    .eq("uploaded_log_id", uploadedLogId)
    .order("line_number", { ascending: true });

  if (error) {
    throw new TranslationDbError(error.message);
  }

  return ((data ?? []) as TranslationRow[]).map(mapTranslationRow);
}

export async function saveTranslations(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    uploadedLogId?: string | null;
    translations: TranslatedAction[];
    model?: string;
  }
): Promise<TranslatedAction[]> {
  const { userId, organizationId, uploadedLogId, translations } = params;
  const model = params.model ?? getGroqModel();

  if (translations.length === 0) {
    throw new TranslationDbError("No translations to save.");
  }

  if (uploadedLogId) {
    const { error: deleteError } = await supabase
      .from("translations")
      .delete()
      .eq("uploaded_log_id", uploadedLogId);

    if (deleteError) {
      throw new TranslationDbError(deleteError.message);
    }
  }

  const rows = translations.map((item) => ({
    organization_id: organizationId,
    uploaded_log_id: uploadedLogId ?? null,
    user_id: userId,
    line_number: item.lineNumber,
    action: item.action,
    explanation: item.explanation,
    affected_system: item.affectedSystem,
    affected_user: item.affectedUser,
    event_timestamp: parseEventTimestamp(item.timestamp),
    business_impact: item.businessImpact,
    ai_confidence: item.aiConfidence,
    model,
    status: "completed" as const,
  }));

  const { data, error } = await supabase
    .from("translations")
    .insert(rows)
    .select(
      "id, line_number, action, explanation, affected_system, affected_user, event_timestamp, business_impact, ai_confidence"
    );

  if (error || !data) {
    throw new TranslationDbError(error?.message ?? "Failed to save translations.");
  }

  return (data as TranslationRow[]).map(mapTranslationRow);
}

export async function getLatestTranslationBatch(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  translations: TranslatedAction[];
  uploadedLogId: string | null;
  organizationId: string;
  sourceFilename: string | null;
} | null> {
  const { data: latest, error } = await supabase
    .from("translations")
    .select("uploaded_log_id, organization_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new TranslationDbError(error.message);
  }

  if (!latest) {
    return null;
  }

  const uploadedLogId = latest.uploaded_log_id as string | null;
  let translations: TranslatedAction[];
  let sourceFilename: string | null = null;

  if (uploadedLogId) {
    translations = await getTranslationsForUploadedLog(supabase, uploadedLogId);

    const { data: log } = await supabase
      .from("uploaded_logs")
      .select("filename")
      .eq("id", uploadedLogId)
      .maybeSingle();

    sourceFilename = log?.filename ?? null;
  } else {
    const anchor = new Date(latest.created_at as string).getTime();
    const windowStart = new Date(anchor - 3000).toISOString();
    const windowEnd = new Date(anchor + 3000).toISOString();

    const { data, error: batchError } = await supabase
      .from("translations")
      .select(
        "id, line_number, action, explanation, affected_system, affected_user, event_timestamp, business_impact, ai_confidence"
      )
      .eq("user_id", userId)
      .is("uploaded_log_id", null)
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .order("line_number", { ascending: true });

    if (batchError) {
      throw new TranslationDbError(batchError.message);
    }

    translations = ((data ?? []) as TranslationRow[]).map(mapTranslationRow);
    sourceFilename = "translated-log";
  }

  if (translations.length === 0) {
    return null;
  }

  return {
    translations,
    uploadedLogId,
    organizationId: latest.organization_id as string,
    sourceFilename,
  };
}

export async function resolveOrganizationId(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  existingOrganizationId?: string
): Promise<string> {
  if (existingOrganizationId) {
    return existingOrganizationId;
  }

  try {
    return await ensureOrganization(supabase, userId, userEmail);
  } catch (err) {
    throw new TranslationDbError(
      err instanceof LogUploadError ? err.message : "Could not resolve organization."
    );
  }
}
