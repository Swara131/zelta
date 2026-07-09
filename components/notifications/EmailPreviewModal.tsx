"use client";

import { X, Mail } from "lucide-react";
import type { NotificationItem } from "@/lib/notification-types";
import SeverityBadge from "@/components/risk/SeverityBadge";
import { CHANNEL_CONFIG } from "@/lib/dummy-notifications";

interface EmailPreviewModalProps {
  notification: NotificationItem | null;
  onClose: () => void;
}

export default function EmailPreviewModal({ notification, onClose }: EmailPreviewModalProps) {
  if (!notification) return null;

  const channel = CHANNEL_CONFIG[notification.channel];

  return (
    <>
      <div
        className="pipeline-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl rounded-2xl ring-1 ring-white/10 sm:inset-x-auto"
        role="dialog"
        aria-label="Notification preview"
      >
        <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
          {/* Email chrome header */}
          <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${channel.color}18`, color: channel.color }}
              >
                <Mail className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Preview — {channel.label}</p>
                <p className="text-xs text-zinc-500">{notification.recipient}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          {/* Email meta */}
          <div className="border-b border-white/6 px-5 py-3 text-sm">
            <div className="flex gap-2 text-zinc-500">
              <span className="shrink-0 font-medium text-zinc-600">Subject:</span>
              <span className="text-zinc-300">{notification.subject}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
              <span>To: {notification.recipient}</span>
              {notification.recipientEmail && (
                <span>{notification.recipientEmail}</span>
              )}
              <span>
                {new Date(notification.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[50vh] overflow-y-auto px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              <SeverityBadge severity={notification.severity} size="sm" />
              <span className="text-sm font-medium text-zinc-300">{notification.risk}</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-400">
              {notification.preview}
            </pre>
          </div>

          <div className="border-t border-white/6 px-5 py-3 text-center text-xs text-zinc-600">
            Preview only — no backend connected
          </div>
        </div>
      </div>
    </>
  );
}
