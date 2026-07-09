"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import type { HistoryEntry } from "@/lib/approval-types";

interface ApprovalHistoryProps {
  entries: HistoryEntry[];
}

export default function ApprovalHistory({ entries }: ApprovalHistoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-white/6 pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left transition-colors hover:text-zinc-300"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <History className="h-3.5 w-3.5" strokeWidth={2} />
          History ({entries.length})
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-600 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
        />
      </button>

      <div
        className={`approval-history-content overflow-hidden transition-all duration-300 ease-out ${
          open ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-3 rounded-lg bg-white/2 px-3 py-2.5 ring-1 ring-white/5"
            >
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-300">{entry.action}</p>
                {entry.note && (
                  <p className="mt-0.5 text-xs text-zinc-500">{entry.note}</p>
                )}
                <p className="mt-1 text-[11px] text-zinc-600">
                  {entry.actor} ·{" "}
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
