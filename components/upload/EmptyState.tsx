"use client";

import { FolderOpen, Upload } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface UploadEmptyStateProps {
  onBrowse: () => void;
}

export default function UploadEmptyState({ onBrowse }: UploadEmptyStateProps) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No uploads yet"
      description="Your recent uploads will appear here. Start by dragging a log file above or browse your files."
      actionLabel="Upload your first file"
      actionIcon={Upload}
      onAction={onBrowse}
    />
  );
}
