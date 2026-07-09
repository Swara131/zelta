"use client";

import {
  Copy,
  Download,
  RefreshCw,
  Languages,
  Check,
} from "lucide-react";
import { useState } from "react";

interface TranslatorToolbarProps {
  disabled: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onTranslateAgain: () => void;
}

export default function TranslatorToolbar({
  disabled,
  onCopy,
  onDownload,
  onRegenerate,
  onTranslateAgain,
}: TranslatorToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buttons = [
    {
      label: copied ? "Copied!" : "Copy",
      icon: copied ? Check : Copy,
      onClick: handleCopy,
      variant: "default" as const,
    },
    {
      label: "Download",
      icon: Download,
      onClick: onDownload,
      variant: "default" as const,
    },
    {
      label: "Regenerate",
      icon: RefreshCw,
      onClick: onRegenerate,
      variant: "default" as const,
    },
    {
      label: "Translate Again",
      icon: Languages,
      onClick: onTranslateAgain,
      variant: "primary" as const,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map(({ label, icon: Icon, onClick, variant }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={
            variant === "primary"
              ? "inline-flex items-center gap-2 rounded-lg bg-indigo-500/15 px-3.5 py-2 text-xs font-medium text-indigo-300 ring-1 ring-indigo-400/25 transition-all hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              : "glass glass-hover inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 transition-all disabled:cursor-not-allowed disabled:opacity-40"
          }
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {label}
        </button>
      ))}
    </div>
  );
}
