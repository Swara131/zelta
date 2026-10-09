import { createAdminClient } from "@/lib/supabase/admin";
import { LOG_UPLOADS_BUCKET } from "@/lib/storage/constants";
import type { ToolExecutionOutcome, ToolHandlerContext } from "../../runtime/types";

const MAX_BYTES = 64_768;

export async function handleReadDocument(
  input: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<ToolExecutionOutcome> {
  const uploadId =
    (typeof input.uploadId === "string" && input.uploadId.trim()) ||
    (typeof input.documentId === "string" && input.documentId.trim()) ||
    null;
  const storagePath =
    typeof input.storagePath === "string" ? input.storagePath.trim() : null;

  if (!uploadId && !storagePath) {
    return {
      executed: false,
      error: "read_document requires uploadId or storagePath.",
      output: {},
    };
  }

  try {
    const admin = createAdminClient();

    let path = storagePath;
    let filename = "document";

    if (uploadId) {
      const { data: row, error } = await admin
        .from("uploaded_logs")
        .select("id, filename, storage_path, user_id")
        .eq("id", uploadId)
        .maybeSingle();

      if (error || !row) {
        return {
          executed: false,
          error: error?.message ?? "Document not found.",
          output: { uploadId },
        };
      }

      const ownerId = typeof row.user_id === "string" ? row.user_id : null;
      const storagePathValue =
        typeof row.storage_path === "string" ? row.storage_path : null;
      const filenameValue = typeof row.filename === "string" ? row.filename : null;
      if (!ownerId || !storagePathValue || !filenameValue) {
        return {
          executed: false,
          error: "Document record is incomplete.",
          output: { uploadId },
        };
      }

      if (ownerId !== context.userId) {
        return {
          executed: false,
          error: "You do not have access to this document.",
          output: { uploadId },
        };
      }

      path = storagePathValue;
      filename = filenameValue;
    } else if (path && !path.startsWith(`${context.userId}/`)) {
      return {
        executed: false,
        error: "You do not have access to this document path.",
        output: { storagePath: path },
      };
    }

    if (!path) {
      return {
        executed: false,
        error: "Could not resolve document path.",
        output: { uploadId, storagePath },
      };
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from(LOG_UPLOADS_BUCKET)
      .download(path);

    if (downloadError || !blob) {
      return {
        executed: false,
        error: downloadError?.message ?? "Failed to download document.",
        output: { storagePath: path },
      };
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const truncated = buffer.length > MAX_BYTES;
    const text = buffer.subarray(0, MAX_BYTES).toString("utf8");

    return {
      executed: true,
      output: {
        filename,
        storagePath: path,
        byteLength: buffer.length,
        truncated,
        content: text,
      },
    };
  } catch (err) {
    return {
      executed: false,
      error: err instanceof Error ? err.message : "Document read failed.",
      output: { uploadId, storagePath },
    };
  }
}
