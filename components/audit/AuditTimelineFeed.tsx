import { RUNTIME_EVENT_TITLES } from "@/lib/gateway/audit/mapper";
import type { AuditTimelineEntry } from "@/lib/audit/types";

interface AuditTimelineFeedProps {
  entries: AuditTimelineEntry[];
}

const ACTION_COLORS: Record<string, string> = {
  create: "#60a5fa",
  update: "#a78bfa",
  approve: "#34d399",
  reject: "#f87171",
  analyze: "#fbbf24",
  notify: "#818cf8",
  upload: "#22d3ee",
  translate: "#c084fc",
  escalate: "#fb7185",
};

function labelForEntry(entry: AuditTimelineEntry): string {
  if (entry.runtimeEvent && entry.runtimeEvent in RUNTIME_EVENT_TITLES) {
    return entry.runtimeEvent;
  }
  return entry.action;
}

export default function AuditTimelineFeed({ entries }: AuditTimelineFeedProps) {
  return (
    <div className="analytics-panel p-5">
      <p className="analytics-panel-title mb-4">Audit Timeline</p>

      <div className="flex flex-col">
        {entries.map((entry, idx) => {
          const color = ACTION_COLORS[entry.action] ?? "#71717a";
          const label = labelForEntry(entry);

          return (
            <div
              key={entry.id}
              className="analytics-activity-item flex gap-4 border-b border-white/5 py-4 last:border-0"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-[#12121a]"
                  style={{ background: `${color}22`, color }}
                >
                  <span className="text-[10px] font-bold uppercase">{entry.action[0]}</span>
                </div>
                {idx < entries.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-white/6" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-zinc-200">{entry.title}</p>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background: `${color}18`,
                      color,
                    }}
                  >
                    {label}
                  </span>
                  {entry.source === "runtime" && (
                    <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                      Runtime
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">{entry.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-600">
                  <span>{entry.actor}</span>
                  <span>
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {entry.proposalId && (
                    <span className="font-mono">proposal {entry.proposalId.slice(0, 8)}…</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
