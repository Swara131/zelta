"use client";

interface UploadProgressProps {
  progress: number;
  filename: string;
}

export default function UploadProgress({ progress, filename }: UploadProgressProps) {
  return (
    <div className="glass-strong fade-in-up rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-200">Uploading…</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{filename}</p>
        </div>
        <span className="font-mono text-sm font-semibold text-indigo-400">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="progress-shimmer h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
