import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { recordAuditAsync } from "@/lib/audit/logger";
import { getOrgSubscription } from "@/lib/billing/repository";
import { BillingError, UsageLimitError } from "@/lib/billing/errors";
import { assertUsageCapacity } from "@/lib/billing/usage";
import { validateLogFile, sanitizeStorageFilename } from "@/lib/security/files";
import type { UploadRecord, UploadStatus } from "@/lib/types";
import { LogUploadError } from "./errors";
import {
  LOG_UPLOADS_BUCKET,
  LOG_UPLOAD_MAX_BYTES,
} from "./constants";

export { LogUploadError } from "./errors";

type UploadedLogUser = { email: string; full_name: string | null };

type UploadedLogRow = {
  id: string;
  filename: string;
  storage_path: string;
  status: string;
  risk_score: number;
  created_at: string;
  users: UploadedLogUser | UploadedLogUser[] | null;
};

const UPLOADED_LOGS_SELECT =
  "id, filename, storage_path, status, risk_score, created_at, users(email, full_name)";

function buildStoragePath(userId: string, filename: string): string {
  return `${userId}/${crypto.randomUUID()}-${sanitizeStorageFilename(filename)}`;
}

function inferMimeType(filename: string, fileType: string): string {
  if (fileType) return fileType;

  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "txt":
    case "log":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

function mapDbStatus(status: string): UploadStatus {
  if (
    status === "completed" ||
    status === "processing" ||
    status === "failed" ||
    status === "pending"
  ) {
    return status;
  }
  return "completed";
}

function rowToRecord(row: UploadedLogRow): UploadRecord {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  const uploadedBy =
    user?.full_name?.trim() ||
    user?.email ||
    "Unknown";

  return {
    id: row.id,
    storagePath: row.storage_path,
    filename: row.filename,
    uploadedBy,
    date: row.created_at,
    status: mapDbStatus(row.status),
    riskScore: row.risk_score ?? 0,
  };
}

function formatStorageError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("bucket") &&
    (lower.includes("not found") || lower.includes("does not exist"))
  ) {
    return "Storage bucket missing. In Supabase SQL Editor, run migration 20260701120000_log_uploads_storage.sql.";
  }
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return `Storage permission denied: ${message}. Run migration 20260701120000_log_uploads_storage.sql in Supabase.`;
  }
  return message;
}

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new LogUploadError("You must be signed in to manage uploads.");
  }

  return user;
}

async function uploadFileToStorage(
  supabase: SupabaseClient,
  storagePath: string,
  file: File,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(LOG_UPLOADS_BUCKET)
    .upload(storagePath, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new LogUploadError(formatStorageError(error.message));
  }
}

/** Server-side upload pipeline (used by /api/uploads). */
export async function executeLogUpload(
  supabase: SupabaseClient,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadRecord> {
  const user = await requireUser(supabase);

  validateLogFile(file);

  if (file.size > LOG_UPLOAD_MAX_BYTES) {
    throw new LogUploadError("File exceeds the 50 MB upload limit.");
  }

  onProgress?.(5);

  const organizationId = await ensureOrganization(
    supabase,
    user.id,
    user.email ?? "user@local"
  );

  try {
    const subscription = await getOrgSubscription(supabase, organizationId);
    await assertUsageCapacity(
      supabase,
      organizationId,
      subscription,
      "storageMb",
      Math.max(1, Math.ceil(file.size / (1024 * 1024)))
    );
  } catch (err) {
    if (err instanceof UsageLimitError || err instanceof BillingError) {
      throw new LogUploadError(err.message);
    }
    throw err;
  }

  const storagePath = buildStoragePath(user.id, file.name);
  const mimeType = inferMimeType(file.name, file.type);

  onProgress?.(10);

  const { data: pendingRow, error: insertError } = await supabase
    .from("uploaded_logs")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      mime_type: mimeType,
      status: "processing",
      risk_score: 0,
    })
    .select(UPLOADED_LOGS_SELECT)
    .single();

  if (insertError || !pendingRow) {
    throw new LogUploadError(insertError?.message ?? "Could not save upload metadata.");
  }

  onProgress?.(20);

  try {
    await uploadFileToStorage(supabase, storagePath, file, mimeType);
    onProgress?.(90);
  } catch (err) {
    await supabase
      .from("uploaded_logs")
      .update({ status: "failed" })
      .eq("id", pendingRow.id);

    throw err;
  }

  const { data: completedRow, error: updateError } = await supabase
    .from("uploaded_logs")
    .update({ status: "completed" })
    .eq("id", pendingRow.id)
    .select(UPLOADED_LOGS_SELECT)
    .single();

  if (updateError || !completedRow) {
    await supabase.storage.from(LOG_UPLOADS_BUCKET).remove([storagePath]);
    await supabase.from("uploaded_logs").delete().eq("id", pendingRow.id);
    throw new LogUploadError(
      updateError?.message ?? "Upload saved but metadata could not be finalized."
    );
  }

  onProgress?.(100);

  recordAuditAsync(supabase, {
    userId: user.id,
    organizationId,
    action: "upload",
    entityType: "uploaded_log",
    entityId: (completedRow as UploadedLogRow).id,
    metadata: {
      description: `Uploaded log file "${file.name}"`,
      filename: file.name,
      fileSizeBytes: file.size,
      mimeType,
    },
  });

  return rowToRecord(completedRow as unknown as UploadedLogRow);
}

export async function listLogUploads(
  supabase: SupabaseClient
): Promise<UploadRecord[]> {
  await requireUser(supabase);

  const { data, error } = await supabase
    .from("uploaded_logs")
    .select(UPLOADED_LOGS_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new LogUploadError(error.message);
  }

  return ((data ?? []) as unknown as UploadedLogRow[]).map(rowToRecord);
}

/** Client helper — posts to /api/uploads so uploads work in embedded browsers. */
export async function uploadLogFile(
  _supabase: SupabaseClient,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadRecord> {
  validateLogFile(file);

  if (file.size > LOG_UPLOAD_MAX_BYTES) {
    throw new LogUploadError("File exceeds the 50 MB upload limit.");
  }

  onProgress?.(10);

  const formData = new FormData();
  formData.append("file", file);

  onProgress?.(25);

  let response: Response;
  try {
    response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new LogUploadError(
      "Could not reach upload server. Refresh the page and try again."
    );
  }

  onProgress?.(80);

  const body = (await response.json().catch(() => ({}))) as {
    record?: UploadRecord;
    error?: string;
  };

  if (!response.ok) {
    throw new LogUploadError(body.error ?? "Upload failed.");
  }

  if (!body.record) {
    throw new LogUploadError("Upload succeeded but no file record was returned.");
  }

  onProgress?.(100);
  return body.record;
}

export async function deleteLogUpload(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const user = await requireUser(supabase);

  const { data: row, error: fetchError } = await supabase
    .from("uploaded_logs")
    .select("storage_path, user_id, filename, organization_id")
    .eq("id", id)
    .single();

  if (fetchError || !row) {
    throw new LogUploadError("Upload not found.");
  }

  if (row.user_id !== user.id) {
    throw new LogUploadError("You can only delete your own uploads.");
  }

  const { error: storageError } = await supabase.storage
    .from(LOG_UPLOADS_BUCKET)
    .remove([row.storage_path]);

  if (storageError) {
    throw new LogUploadError(storageError.message);
  }

  const { error: dbError } = await supabase
    .from("uploaded_logs")
    .delete()
    .eq("id", id);

  if (dbError) {
    throw new LogUploadError(dbError.message);
  }

  recordAuditAsync(supabase, {
    userId: user.id,
    organizationId: row.organization_id as string,
    action: "delete",
    entityType: "uploaded_log",
    entityId: id,
    metadata: {
      description: `Deleted log file "${row.filename}"`,
      filename: row.filename,
    },
  });
}

export async function getLogUploadPreviewUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string> {
  const user = await requireUser(supabase);

  if (!storagePath.startsWith(`${user.id}/`)) {
    throw new LogUploadError("You can only preview your own uploads.");
  }

  const { data, error } = await supabase.storage
    .from(LOG_UPLOADS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    throw new LogUploadError(error?.message ?? "Could not generate preview URL.");
  }

  return data.signedUrl;
}

export function getStoragePathFromUpload(upload: UploadRecord): string | null {
  return upload.storagePath ?? null;
}
