"use client";

import { buildPieSlicePaths } from "@/lib/charts/build-pie-slices";
import type { RiskDistribution } from "@/lib/risk-types";
import { SEVERITY_COLORS } from "@/lib/risk/severity";

interface RiskPieChartProps {
  data: RiskDistribution[];
}

export default function RiskPieChart({ data }: RiskPieChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const cx = 100;
  const cy = 100;
  const radius = 72;
  const paths = buildPieSlicePaths(
    data.map((item) => ({ value: item.count })),
    cx,
    cy,
    radius
  );

  const slices = data.map((item, index) => ({
    ...item,
    path: paths[index] ?? "",
    color: SEVERITY_COLORS[item.severity].fill,
  }));
  return (
    <div className="defender-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="defender-panel-title">Risk Distribution</p>
        <span className="text-xs text-zinc-500">{total} total findings</span>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <svg width="200" height="200" viewBox="0 0 200 200" className="shrink-0">
          {slices.map((slice) => (
            <path
              key={slice.severity}
              d={slice.path}
              fill={slice.color}
              stroke="#141414"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80"
            />
          ))}
          <circle cx={cx} cy={cy} r="42" fill="#1a1a1e" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-zinc-300 text-2xl font-bold"
            style={{ fontFamily: "var(--font-geist-sans)" }}
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-zinc-500 text-[10px] uppercase tracking-wider"
          >
            Risks
          </text>
        </svg>

        <div className="flex flex-1 flex-col gap-2.5 pt-2">
          {data.map((item) => {
            const pct = Math.round((item.count / total) * 100);
            const color = SEVERITY_COLORS[item.severity];
            return (
              <div key={item.severity} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: color.fill }}
                />
                <span className="flex-1 text-sm text-zinc-400">{item.label}</span>
                <span className="font-mono text-sm font-semibold text-zinc-200">
                  {item.count}
                </span>
                <span className="w-10 text-right font-mono text-xs text-zinc-600">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
