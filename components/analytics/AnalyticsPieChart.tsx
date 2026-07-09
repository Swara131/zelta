"use client";

import { buildPieSlicePaths } from "@/lib/charts/build-pie-slices";
import type { PieSlice } from "@/lib/analytics-types";

interface AnalyticsPieChartProps {
  title: string;
  subtitle?: string;
  data: PieSlice[];
}

export default function AnalyticsPieChart({ title, subtitle, data }: AnalyticsPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = 100;
  const cy = 100;
  const radius = 70;
  const paths = buildPieSlicePaths(data, cx, cy, radius);

  const slices = data.map((item, index) => ({
    ...item,
    path: paths[index] ?? "",
    pct: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }));

  return (
    <div className="analytics-panel h-full p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="analytics-panel-title">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-600">{subtitle}</p>}
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <svg width="180" height="180" viewBox="0 0 200 200" className="shrink-0">
          {slices.map((slice) => (
            <path
              key={slice.label}
              d={slice.path}
              fill={slice.color}
              stroke="#12121a"
              strokeWidth="2"
              className="transition-opacity hover:opacity-85"
            />
          ))}
          <circle cx={cx} cy={cy} r="40" fill="#1a1a22" />
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-zinc-200 text-xl font-bold"
            style={{ fontFamily: "var(--font-geist-sans)" }}
          >
            {total.toLocaleString()}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-zinc-600 text-[9px] uppercase tracking-wider"
          >
            Total
          </text>
        </svg>

        <div className="flex w-full flex-col gap-2">
          {slices.map((slice) => (
            <div key={slice.label} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: slice.color }}
              />
              <span className="flex-1 truncate text-sm text-zinc-400">{slice.label}</span>
              <span className="font-mono text-xs text-zinc-500">{slice.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
