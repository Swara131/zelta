"use client";

import { Languages, FileSearch } from "lucide-react";
import TranslationCard from "./TranslationCard";
import TypingIndicator from "./TypingIndicator";
import TranslatorToolbar from "./TranslatorToolbar";
import type { TranslatedAction, TranslatorStatus } from "@/lib/translator-types";

interface TranslationPanelProps {
  status: TranslatorStatus;
  translations: TranslatedAction[];
  visibleCount: number;
  typingIndex: number;
  onTypingComplete: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onTranslateAgain: () => void;
}

export default function TranslationPanel({
  status,
  translations,
  visibleCount,
  typingIndex,
  onTypingComplete,
  onCopy,
  onDownload,
  onRegenerate,
  onTranslateAgain,
}: TranslationPanelProps) {
  const visible = translations.slice(0, visibleCount);
  const isComplete = status === "complete";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-violet-400" strokeWidth={2} />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Plain English Translation
          </span>
          {isComplete && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 ring-1 ring-emerald-400/20">
              {translations.length} actions
            </span>
          )}
        </div>
        {isComplete && (
          <TranslatorToolbar
            disabled={false}
            onCopy={onCopy}
            onDownload={onDownload}
            onRegenerate={onRegenerate}
            onTranslateAgain={onTranslateAgain}
          />
        )}
      </div>

      <div className="translation-scroll flex-1 overflow-auto p-4">
        {status === "idle" && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="gentle-pulse mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/5 ring-1 ring-white/8">
              <FileSearch className="h-10 w-10 text-zinc-600" strokeWidth={1.25} />
            </div>
            <p className="text-sm font-medium text-zinc-400">No translation yet</p>
            <p className="mt-1 max-w-xs text-xs text-zinc-600">
              Upload a technical log above and click Translate to see plain English
              explanations of each agent action.
            </p>
          </div>
        )}

        {status === "translating" && visibleCount === 0 && <TypingIndicator />}

        <div className="flex flex-col gap-4">
          {visible.map((action, idx) => (
            <TranslationCard
              key={action.id}
              action={action}
              isTyping={status === "translating" && idx === typingIndex}
              onTypingComplete={
                status === "translating" && idx === typingIndex
                  ? onTypingComplete
                  : undefined
              }
            />
          ))}

          {status === "translating" && visibleCount > 0 && typingIndex >= visibleCount && (
            <div className="flex items-center justify-center py-6">
              <div className="typing-dots flex items-center gap-1.5">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
