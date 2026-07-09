"use client";

import type { TrendPoint } from "@/lib/analytics-types";

interface AnalyticsAreaChartProps {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}

export default function AnalyticsAreaChart({
  title,
  subtitle,
  data,
  primaryLabel = "Actions",
  secondaryLabel = "Blocked",
}: AnalyticsAreaChartProps) {
  const width = 520;
  const height = 220;
  const padX = 44;
  const padY = 28;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const maxVal = Math.max(...data.map((d) => d.value)) * 1.1;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + chartH} L ${points[0].x} ${padY + chartH} Z`;

  const secPoints = data
    .filter((d) => d.secondary !== undefined)
    .map((d, i, arr) => ({
      x: padX + (data.indexOf(d) / (data.length - 1)) * chartW,
      y: padY + chartH - ((d.secondary ?? 0) / maxVal) * chartH,
    }));

  const secPath =
    secPoints.length > 1
      ? secPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
      : "";

  return (
    <div className="analytics-panel h-full p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="analytics-panel-title">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-indigo-500" />
            {primaryLabel}
          </span>
          {secPath && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-red-400" />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="min-w-[300px]"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padY + chartH * (1 - pct);
            return (
              <line
                key={pct}
                x1={padX}
                y1={y}
                x2={padX + chartW}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
            );
          })}

          <path d={areaPath} fill="url(#areaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {secPath && (
            <path
              d={secPath}
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 4"
            />
          )}

          {points.map((p) => (
            <g key={p.label}>
              <circle cx={p.x} cy={p.y} r="4" fill="#12121a" stroke="#6366f1" strokeWidth="2" />
              <text
                x={p.x}
                y={padY + chartH + 18}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px]"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
