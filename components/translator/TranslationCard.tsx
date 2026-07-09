"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Server,
  User,
  Clock,
  AlertTriangle,
  Brain,
} from "lucide-react";
import type { TranslatedAction } from "@/lib/translator-types";

interface TranslationCardProps {
  action: TranslatedAction;
  isTyping?: boolean;
  onTypingComplete?: () => void;
}

const IMPACT_STYLES: Record<
  TranslatedAction["businessImpact"],
  { label: string; className: string }
> = {
  critical: { label: "Critical", className: "impact-critical" },
  high: { label: "High", className: "impact-high" },
  medium: { label: "Medium", className: "impact-medium" },
  low: { label: "Low", className: "impact-low" },
  none: { label: "None", className: "impact-none" },
};

function useTypewriter(text: string, active: boolean, speed = 12) {
  const [typedLength, setTypedLength] = useState(active ? 0 : text.length);
  const done = !active || typedLength >= text.length;
  const displayed = active ? text.slice(0, typedLength) : text;

  useEffect(() => {
    if (!active) {
      setTypedLength(text.length);
      return;
    }

    setTypedLength(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTypedLength(i);
      if (i >= text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, active, speed]);

  return { displayed, done };
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 95 ? "bg-emerald-500" : value >= 85 ? "bg-indigo-500" : "bg-amber-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono text-xs font-semibold text-zinc-400">{value}%</span>
    </div>
  );
}

function MetaField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-zinc-300">{value}</p>
      </div>
    </div>
  );
}

export default function TranslationCard({
  action,
  isTyping = false,
  onTypingComplete,
}: TranslationCardProps) {
  const { displayed, done } = useTypewriter(action.explanation, isTyping);
  const impact = IMPACT_STYLES[action.businessImpact];
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isTyping) {
      firedRef.current = false;
      return;
    }
    if (done && !firedRef.current && onTypingComplete) {
      firedRef.current = true;
      onTypingComplete();
    }
  }, [done, isTyping, onTypingComplete]);

  return (
    <article className="translation-card fade-in-up glass-strong rounded-xl p-5 ring-1 ring-white/6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 font-mono text-xs font-bold text-indigo-400 ring-1 ring-indigo-400/20">
            {action.lineNumber}
          </span>
          <h4 className="text-base font-semibold text-zinc-100">{action.action}</h4>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${impact.className}`}
        >
          {impact.label}
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-zinc-400">
        {displayed}
        {isTyping && !done && <span className="typing-cursor" />}
      </p>

      <div className="grid gap-4 border-t border-white/6 pt-4 sm:grid-cols-2">
        <MetaField icon={Server} label="Affected System" value={action.affectedSystem} />
        <MetaField icon={User} label="Affected User" value={action.affectedUser} />
        <MetaField
          icon={Clock}
          label="Timestamp"
          value={new Date(action.timestamp).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "medium",
          })}
        />
        <MetaField
          icon={AlertTriangle}
          label="Business Impact"
          value={impact.label}
        />
      </div>

      <div className="mt-4 border-t border-white/6 pt-4">
        <div className="mb-2 flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            AI Confidence
          </span>
        </div>
        <ConfidenceBar value={action.aiConfidence} />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
        <Activity className="h-3 w-3" strokeWidth={2} />
        <span>Translated from log line {action.lineNumber}</span>
      </div>
    </article>
  );
}
