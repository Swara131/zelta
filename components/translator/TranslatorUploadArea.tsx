"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload, Languages, ChevronDown } from "lucide-react";
import { ACCEPTED_MIME_TYPES } from "@/lib/types";
import type { UploadedLogSummary } from "@/lib/translator-types";

interface TranslatorUploadAreaProps {
  filename: string | null;
  onFileLoad: (content: string, filename: string) => void;
  onTranslate: () => void;
  isTranslating: boolean;
  hasContent: boolean;
  uploads?: UploadedLogSummary[];
  selectedUploadId?: string | null;
  onUploadSelect?: (uploadId: string) => void;
  loadingUploads?: boolean;
  loadingLog?: boolean;
}

export default function TranslatorUploadArea({
  filename,
  onFileLoad,
  onTranslate,
  isTranslating,
  hasContent,
  uploads = [],
  selectedUploadId = null,
  onUploadSelect,
  loadingUploads = false,
  loadingLog = false,
}: TranslatorUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileLoad(content, file.name);
      };
      reader.readAsText(file);
    },
    [onFileLoad]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const busy = isTranslating || loadingLog;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`glass-strong rounded-2xl p-4 transition-all sm:p-5 ${
        isDragging ? "dropzone-active ring-1 ring-indigo-400/30" : ""
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      {uploads.length > 0 && onUploadSelect && (
        <div className="mb-4">
          <label htmlFor="uploaded-log-select" className="mb-1.5 block text-xs font-medium text-zinc-500">
            Select from uploaded logs
          </label>
          <div className="relative">
            <select
              id="uploaded-log-select"
              value={selectedUploadId ?? ""}
              onChange={(e) => {
                if (e.target.value) onUploadSelect(e.target.value);
              }}
              disabled={busy || loadingUploads}
              className="ds-input w-full appearance-none pr-10"
            >
              <option value="" disabled>
                {loadingUploads ? "Loading uploads…" : "Choose an uploaded log…"}
              </option>
              {uploads.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {upload.filename}
                  {upload.hasTranslations ? " (translated)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="glass glass-hover flex flex-1 items-center gap-4 rounded-xl px-5 py-4 text-left transition-all disabled:opacity-50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/20">
            {filename ? (
              <FileText className="h-5 w-5 text-indigo-400" strokeWidth={1.75} />
            ) : (
              <Upload className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0">
            {loadingLog ? (
              <>
                <p className="text-sm font-medium text-zinc-200">Loading log file…</p>
                <p className="text-xs text-zinc-500">Reading from Supabase Storage</p>
              </>
            ) : filename ? (
              <>
                <p className="truncate text-sm font-medium text-zinc-200">{filename}</p>
                <p className="text-xs text-zinc-500">Ready for translation</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-300">
                  Drop a log file or click to browse
                </p>
                <p className="text-xs text-zinc-500">CSV, TXT, JSON, LOG supported</p>
              </>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={onTranslate}
          disabled={!hasContent || busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Languages className="h-4 w-4" strokeWidth={2} />
          {isTranslating ? "Translating…" : loadingLog ? "Loading…" : "Translate"}
        </button>
      </div>
    </div>
  );
}
