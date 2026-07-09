import { ACCEPTED_EXTENSIONS } from "@/lib/types";
import {
  LOG_UPLOAD_MAX_BYTES,
  LOG_UPLOAD_MIME_TYPES,
} from "@/lib/storage/constants";
import { LogUploadError } from "@/lib/storage/errors";
import { filenameSchema, MAX_FILENAME_LENGTH } from "./validation";

const EXTENSION_MIME: Record<string, readonly string[]> = {
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"],
  ".txt": ["text/plain", "application/octet-stream"],
  ".json": ["application/json", "text/plain", "application/octet-stream"],
  ".log": ["text/plain", "application/octet-stream"],
};

/** Reject content that looks binary (NUL bytes in first 8KB sample). */
export function assertTextLikeContent(buffer: ArrayBuffer, filename: string): void {
  const bytes = new Uint8Array(buffer.slice(0, 8192));
  if (bytes.includes(0)) {
    throw new LogUploadError(
      `File "${filename}" appears to be binary. Only text-based log files are allowed.`
    );
  }
}

/** Validate upload metadata and optionally sniff first bytes. */
export function validateLogFile(file: File, contentSample?: ArrayBuffer): void {
  if (file.size <= 0) {
    throw new LogUploadError("File is empty.");
  }

  if (file.size > LOG_UPLOAD_MAX_BYTES) {
    throw new LogUploadError("File exceeds the 50 MB upload limit.");
  }

  if (file.name.length > MAX_FILENAME_LENGTH) {
    throw new LogUploadError("Filename is too long.");
  }

  const parsed = filenameSchema.safeParse(file.name);
  if (!parsed.success) {
    throw new LogUploadError(parsed.error.issues[0]?.message ?? "Invalid filename.");
  }

  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}` as (typeof ACCEPTED_EXTENSIONS)[number];
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new LogUploadError(
      "Unsupported file type. Please upload CSV, TXT, JSON, or LOG files."
    );
  }

  if (file.type) {
    const allowedForExt = EXTENSION_MIME[ext] ?? [];
    const allowedGlobal = LOG_UPLOAD_MIME_TYPES as readonly string[];
    if (
      !allowedForExt.includes(file.type) &&
      !allowedGlobal.includes(file.type)
    ) {
      throw new LogUploadError(
        "Declared file type does not match the file extension."
      );
    }
  }

  if (contentSample) {
    assertTextLikeContent(contentSample, file.name);
  }
}

export function sanitizeStorageFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, MAX_FILENAME_LENGTH);
}
