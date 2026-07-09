/** Supabase Storage bucket for agent log files. */
export const LOG_UPLOADS_BUCKET = "log-uploads";

/** Max file size: 50 MB */
export const LOG_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const LOG_UPLOAD_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/json",
  "application/octet-stream",
] as const;
