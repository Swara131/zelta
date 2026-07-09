"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FolderOpen,
  FileDown,
  Clock,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import UploadDropzone from "./UploadDropzone";
import UploadProgress from "./UploadProgress";
import SuccessOverlay from "./SuccessOverlay";
import RecentUploadsTable from "./RecentUploadsTable";
import EmptyState from "./EmptyState";
import { SAMPLE_FILE_CONTENT, SAMPLE_FILENAME } from "@/lib/dummy-uploads";
import { createClient } from "@/lib/supabase/client";
import {
  deleteLogUpload,
  getLogUploadPreviewUrl,
  getStoragePathFromUpload,
  listLogUploads,
  LogUploadError,
  uploadLogFile,
} from "@/lib/storage/log-uploads";
import type { UploadRecord } from "@/lib/types";

export default function UploadLogsPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFilename, setUploadingFilename] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successFilename, setSuccessFilename] = useState("");
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const refreshUploads = useCallback(async () => {
    setLoadError(null);
    try {
      const supabase = createClient();
      const records = await listLogUploads(supabase);
      setUploads(records);
    } catch (err) {
      setLoadError(
        err instanceof LogUploadError ? err.message : "Failed to load uploads."
      );
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  useEffect(() => {
    refreshUploads();
  }, [refreshUploads]);

  const runUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadingFilename(file.name);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const supabase = createClient();
      const record = await uploadLogFile(supabase, file, setUploadProgress);

      setUploads((prev) => [record, ...prev]);
      setSuccessFilename(file.name);
      setShowSuccess(true);
      setSelectedFile(null);
    } catch (err) {
      const message =
        err instanceof LogUploadError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed. Please try again.";
      setUploadError(message);
      await refreshUploads();
    } finally {
      setIsUploading(false);
      setUploadingFilename("");
      setUploadProgress(0);
    }
  }, [refreshUploads]);

  const handleUpload = () => {
    if (selectedFile && !isUploading) {
      runUpload(selectedFile);
    }
  };

  const handleSampleFile = () => {
    const blob = new Blob([SAMPLE_FILE_CONTENT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SAMPLE_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBrowse = () => {
    dropzoneRef.current?.querySelector<HTMLInputElement>("input[type=file]")?.click();
  };

  const handlePreview = async (id: string) => {
    const upload = uploads.find((u) => u.id === id);
    const storagePath = upload ? getStoragePathFromUpload(upload) : null;
    if (!storagePath) return;

    try {
      const supabase = createClient();
      const url = await getLogUploadPreviewUrl(supabase, storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(
        err instanceof LogUploadError ? err.message : "Could not open file preview."
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const supabase = createClient();
      await deleteLogUpload(supabase, id);
      setUploads((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert(err instanceof LogUploadError ? err.message : "Failed to delete file.");
    }
  };

  const handleRetry = async (id: string) => {
    const upload = uploads.find((u) => u.id === id);
    if (!upload || upload.status !== "failed") return;

    setUploads((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: "processing" as const } : u
      )
    );

    setUploads((prev) => prev.filter((u) => u.id !== id));
    handleBrowse();
  };

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        icon={Upload}
        title="Upload Logs"
        description="Import agent action logs for automated risk scoring and approval workflows. Supports CSV, TXT, JSON, and LOG formats."
      />

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div ref={dropzoneRef}>
          <UploadDropzone
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            disabled={isUploading}
          />
        </div>

        {uploadError && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {uploadError}
          </p>
        )}

        {isUploading && uploadingFilename && (
          <div className="mt-4">
            <UploadProgress progress={uploadProgress} filename={uploadingFilename} />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="secondary" icon={FolderOpen} onClick={handleBrowse} disabled={isUploading}>
            Browse Files
          </Button>
          <Button
            variant="primary"
            icon={Upload}
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            loading={isUploading}
          >
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
          <Button
            variant="ghost"
            icon={FileDown}
            onClick={handleSampleFile}
            disabled={isUploading}
            className="sm:ml-auto"
          >
            Sample File
          </Button>
        </div>
      </section>

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.1s" }}>
        <SectionHeader
          icon={Clock}
          title="Recent Uploads"
          trailing={
            <span className="ds-caption">
              {loadingUploads
                ? "Loading…"
                : `${uploads.length} ${uploads.length === 1 ? "file" : "files"}`}
            </span>
          }
        />

        <div className="ds-panel">
          {loadError && (
            <p className="border-b border-[var(--ds-border)] px-6 py-4 text-sm text-red-400" role="alert">
              {loadError}
            </p>
          )}
          {loadingUploads ? (
            <div className="flex items-center justify-center gap-2 py-16 ds-caption">
              <span className="ds-spinner ds-spinner-lg" aria-hidden="true" />
              Loading uploads…
            </div>
          ) : uploads.length === 0 ? (
            <EmptyState onBrowse={handleBrowse} />
          ) : (
            <RecentUploadsTable
              uploads={uploads}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          )}
        </div>
      </section>

      {showSuccess && (
        <SuccessOverlay
          filename={successFilename}
          onDismiss={() => setShowSuccess(false)}
        />
      )}
    </PageShell>
  );
}
