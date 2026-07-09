"use client";

import { useCallback, useRef, useState } from "react";
import {
  CloudUpload,
  FileSpreadsheet,
  FileJson,
  FileText,
  ScrollText,
} from "lucide-react";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from "@/lib/types";

interface UploadDropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

const FILE_TYPE_ICONS = [
  { ext: "CSV", icon: FileSpreadsheet, color: "text-emerald-400" },
  { ext: "TXT", icon: FileText, color: "text-sky-400" },
  { ext: "JSON", icon: FileJson, color: "text-amber-400" },
  { ext: "LOG", icon: ScrollText, color: "text-violet-400" },
];

function isAcceptedFile(file: File): boolean {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(
    ext as (typeof ACCEPTED_EXTENSIONS)[number]
  );
}

export default function UploadDropzone({
  selectedFile,
  onFileSelect,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (isAcceptedFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`ds-panel relative flex min-h-[280px] flex-col items-center justify-center border-2 border-dashed p-8 transition-all duration-300 sm:min-h-[320px] ${
        isDragging ? "dropzone-active" : "border-[var(--ds-border)]"
      } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-[var(--ds-border-hover)]"}`}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label="Upload area. Drag and drop a file or click to browse."
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {selectedFile ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--ds-brand-muted)] ring-1 ring-[var(--ds-brand-ring)]">
            <CloudUpload className="h-8 w-8 text-[var(--ds-brand)]" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-medium text-[var(--ds-text-primary)]">{selectedFile.name}</p>
            <p className="mt-1 ds-caption">
              {(selectedFile.size / 1024).toFixed(1)} KB — ready to upload
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-sm text-[var(--ds-text-tertiary)] transition-colors hover:text-[var(--ds-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          >
            Remove file
          </button>
        </div>
      ) : (
        <>
          <div
            className={`mb-6 flex h-20 w-20 items-center justify-center rounded-[var(--ds-radius-xl)] bg-[var(--ds-brand-muted)] ring-1 ring-[var(--ds-border)] transition-transform duration-300 ${
              isDragging ? "scale-110" : ""
            }`}
          >
            <CloudUpload
              className={`h-10 w-10 transition-colors ${isDragging ? "text-[var(--ds-brand)]" : "text-[var(--ds-text-tertiary)]"}`}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>

          <h2 className="ds-section-title text-xl sm:text-2xl">
            {isDragging ? "Drop your file here" : "Drag & drop your log file"}
          </h2>
          <p className="mt-2 max-w-sm text-center ds-caption">
            or click to browse from your computer
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {FILE_TYPE_ICONS.map(({ ext, icon: Icon, color }) => (
              <span
                key={ext}
                className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400"
              >
                <Icon className={`h-3.5 w-3.5 ${color}`} strokeWidth={2} />
                {ext}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
