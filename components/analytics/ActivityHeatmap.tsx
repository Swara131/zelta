"use client";

import { useState } from "react";
import type { HeatmapCell } from "@/lib/analytics-types";
import { HEATMAP_DAYS } from "@/lib/dummy-analytics";

interface ActivityHeatmapProps {
  data: HeatmapCell[];
}

function getHeatColor(value: number, max: number): string {
  const intensity = value / max;
  if (intensity < 0.2) return "rgba(99, 102, 241, 0.08)";
  if (intensity < 0.4) return "rgba(99, 102, 241, 0.2)";
  if (intensity < 0.6) return "rgba(99, 102, 241, 0.4)";
  if (intensity < 0.8) return "rgba(99, 102, 241, 0.65)";
  return "rgba(99, 102, 241, 0.95)";
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const max = Math.max(...data.map((d) => d.value));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="analytics-panel h-full p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="analytics-panel-title">Activity Heatmap</p>
          <p className="mt-0.5 text-xs text-zinc-600">Actions by day and hour</p>
        </div>
        {hovered && (
          <span className="font-mono text-xs text-indigo-400">
            {HEATMAP_DAYS[hovered.day]} {hovered.hour}:00 — {hovered.value} actions
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Hour labels */}
          <div className="mb-1 flex pl-10">
            {hours.filter((h) => h % 3 === 0).map((h) => (
              <span
                key={h}
                className="text-[9px] text-zinc-600"
                style={{ width: `${(100 / 24) * 3}%` }}
              >
                {h}:00
              </span>
            ))}
          </div>

          {/* Grid */}
          {HEATMAP_DAYS.map((day, dayIdx) => (
            <div key={day} className="mb-0.5 flex items-center gap-1">
              <span className="w-9 shrink-0 text-right text-[10px] text-zinc-600">{day}</span>
              <div className="flex flex-1 gap-0.5">
                {hours.map((hour) => {
                  const cell = data.find((d) => d.day === dayIdx && d.hour === hour)!;
                  return (
                    <div
                      key={hour}
                      className="heatmap-cell h-4 flex-1 rounded-sm transition-all duration-150"
                      style={{ background: getHeatColor(cell.value, max) }}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${day} ${hour}:00 — ${cell.value} actions`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <span className="text-[10px] text-zinc-600">Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.95].map((v) => (
              <div
                key={v}
                className="h-3 w-3 rounded-sm"
                style={{ background: getHeatColor(v * max, max) }}
              />
            ))}
            <span className="text-[10px] text-zinc-600">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
