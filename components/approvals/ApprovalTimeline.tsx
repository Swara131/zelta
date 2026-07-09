"use client";

import {
  Upload,
  Brain,
  Shield,
  UserCheck,
  MessageSquare,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineEvent } from "@/lib/approval-types";

const TYPE_ICONS: Record<TimelineEvent["type"], LucideIcon> = {
  created: Upload,
  analyzed: Brain,
  assigned: UserCheck,
  comment: MessageSquare,
  escalated: AlertTriangle,
  action: Zap,
};

const TYPE_COLORS: Record<TimelineEvent["type"], string> = {
  created: "#60a5fa",
  analyzed: "#a78bfa",
  assigned: "#34d399",
  comment: "#71717a",
  escalated: "#ff4769",
  action: "#fbbf24",
};

interface ApprovalTimelineProps {
  events: TimelineEvent[];
}

export default function ApprovalTimeline({ events }: ApprovalTimelineProps) {
  return (
    <div className="approval-timeline">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Timeline
      </p>
      <div className="relative">
        <div className="absolute bottom-2 left-[15px] top-2 w-px bg-white/8" />

        <div className="flex flex-col gap-0">
          {events.map((event, idx) => {
            const Icon = TYPE_ICONS[event.type];
            const color = TYPE_COLORS[event.type];

            return (
              <div
                key={event.id}
                className="approval-timeline-item relative flex gap-4 pb-5 last:pb-0"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div
                  className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-[#141414]"
                  style={{ background: `${color}22`, color }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium text-zinc-200">{event.title}</p>
                    <time className="font-mono text-[11px] text-zinc-600">
                      {new Date(event.timestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{event.description}</p>
                  <p className="mt-1 text-[11px] text-zinc-600">{event.actor}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
