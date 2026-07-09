"use client";

import type { LucideIcon } from "lucide-react";
import {
  Eye,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  FileJson,
  FileText,
  ScrollText,
  MoreHorizontal,
} from "lucide-react";
import type { UploadRecord, UploadStatus } from "@/lib/types";

interface RecentUploadsTableProps {
  uploads: UploadRecord[];
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

function FileTypeIcon({
  filename,
  className,
}: {
  filename: string;
  className?: string;
}) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const iconProps = {
    className,
    strokeWidth: 1.75 as const,
    "aria-hidden": true as const,
  };

  switch (ext) {
    case "csv":
      return <FileSpreadsheet {...iconProps} />;
    case "json":
      return <FileJson {...iconProps} />;
    case "log":
      return <ScrollText {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

function getRiskClass(score: number): string {
  if (score <= 30) return "risk-low";
  if (score <= 60) return "risk-medium";
  return "risk-high";
}

function getStatusClass(status: UploadStatus): string {
  return `status-${status}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const labels: Record<UploadStatus, string> = {
    completed: "Completed",
    processing: "Processing",
    failed: "Failed",
    pending: "Pending",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusClass(status)}`}
    >
      {status === "processing" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {labels[status]}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-[var(--ds-radius-sm)] p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)] ${
        variant === "danger"
          ? "text-[var(--ds-text-tertiary)] hover:bg-red-500/10 hover:text-red-400"
          : "text-[var(--ds-text-tertiary)] hover:bg-[var(--ds-bg-subtle)] hover:text-[var(--ds-text-primary)]"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

function UploadRow({
  upload,
  onPreview,
  onDelete,
  onRetry,
}: {
  upload: UploadRecord;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <tr className="upload-row">
      <td>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-bg-subtle)] ring-1 ring-[var(--ds-border)]">
            <FileTypeIcon
              filename={upload.filename}
              className="h-4 w-4 text-[var(--ds-brand)]"
            />
          </div>
          <span className="truncate text-sm font-medium text-[var(--ds-text-primary)]">
            {upload.filename}
          </span>
        </div>
      </td>
      <td className="hidden lg:table-cell">{upload.uploadedBy}</td>
      <td className="hidden lg:table-cell">{formatDate(upload.date)}</td>
      <td className="px-4 py-4 sm:px-6">
        <StatusBadge status={upload.status} />
      </td>
      <td className="px-4 py-4 sm:px-6">
        <span className={`font-mono text-sm font-semibold ${getRiskClass(upload.riskScore)}`}>
          {upload.riskScore}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-6">
        <div className="flex items-center gap-0.5">
          <ActionButton
            icon={Eye}
            label="Preview"
            onClick={() => onPreview(upload.id)}
          />
          {upload.status === "failed" && (
            <ActionButton
              icon={RotateCcw}
              label="Retry"
              onClick={() => onRetry(upload.id)}
            />
          )}
          <ActionButton
            icon={Trash2}
            label="Delete"
            onClick={() => onDelete(upload.id)}
            variant="danger"
          />
        </div>
      </td>
    </tr>
  );
}

function MobileUploadCard({
  upload,
  onPreview,
  onDelete,
  onRetry,
}: {
  upload: UploadRecord;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <div className="ds-panel upload-row p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/8">
            <FileTypeIcon filename={upload.filename} className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-200">
              {upload.filename}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{upload.uploadedBy}</p>
          </div>
        </div>
        <StatusBadge status={upload.status} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{formatDate(upload.date)}</span>
          <span>
            Risk:{" "}
            <span className={`font-mono font-semibold ${getRiskClass(upload.riskScore)}`}>
              {upload.riskScore}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <ActionButton icon={Eye} label="Preview" onClick={() => onPreview(upload.id)} />
          {upload.status === "failed" && (
            <ActionButton icon={RotateCcw} label="Retry" onClick={() => onRetry(upload.id)} />
          )}
          <ActionButton
            icon={Trash2}
            label="Delete"
            onClick={() => onDelete(upload.id)}
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
}

export default function RecentUploadsTable({
  uploads,
  onPreview,
  onDelete,
  onRetry,
}: RecentUploadsTableProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="ds-table-wrap hidden md:block">
        <table className="ds-table">
          <thead>
            <tr>
              <th scope="col">Filename</th>
              <th scope="col" className="hidden lg:table-cell">Uploaded By</th>
              <th scope="col" className="hidden lg:table-cell">Date</th>
              <th scope="col">Status</th>
              <th scope="col">Risk Score</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
                <MoreHorizontal className="h-4 w-4 opacity-50" aria-hidden="true" />
              </th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                onPreview={onPreview}
                onDelete={onDelete}
                onRetry={onRetry}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {uploads.map((upload) => (
          <MobileUploadCard
            key={upload.id}
            upload={upload}
            onPreview={onPreview}
            onDelete={onDelete}
            onRetry={onRetry}
          />
        ))}
      </div>
    </>
  );
}
