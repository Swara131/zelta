"use client";

import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 ring-1 ring-violet-400/20">
        <Sparkles className="h-8 w-8 text-violet-400" strokeWidth={1.5} />
      </div>

      <p className="text-sm font-medium text-zinc-300">AI is translating your log…</p>
      <p className="mt-1 text-xs text-zinc-600">
        Converting technical entries to plain English
      </p>

      <div className="typing-dots mt-6 flex items-center gap-1.5">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
