export type UploadStatus = "completed" | "processing" | "failed" | "pending";

export interface UploadRecord {
  id: string;
  /** Full path in Supabase Storage: `{userId}/{uuid}-{filename}` */
  storagePath?: string;
  filename: string;
  uploadedBy: string;
  date: string;
  status: UploadStatus;
  riskScore: number;
}

export const ACCEPTED_EXTENSIONS = [".csv", ".txt", ".json", ".log"] as const;
export const ACCEPTED_MIME_TYPES =
  "text/csv,text/plain,application/json,.csv,.txt,.json,.log";
