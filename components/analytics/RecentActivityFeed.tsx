import { ACTIVITY_TYPE_CONFIG } from "@/lib/dummy-analytics";
import type { ActivityItem } from "@/lib/analytics-types";

interface RecentActivityFeedProps {
  items: ActivityItem[];
}

export default function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <div className="analytics-panel p-5">
      <p className="analytics-panel-title mb-4">Recent Activity</p>

      <div className="flex flex-col">
        {items.map((item, idx) => {
          const config = ACTIVITY_TYPE_CONFIG[item.type];

          return (
            <div
              key={item.id}
              className="analytics-activity-item flex gap-4 border-b border-white/5 py-4 last:border-0"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-[#12121a]"
                  style={{ background: `${config.color}22`, color: config.color }}
                >
                  <span className="text-[10px] font-bold uppercase">{item.type[0]}</span>
                </div>
                {idx < items.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-white/6" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background: `${config.color}18`,
                      color: config.color,
                    }}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">{item.description}</p>
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  {item.actor} ·{" "}
                  {new Date(item.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
