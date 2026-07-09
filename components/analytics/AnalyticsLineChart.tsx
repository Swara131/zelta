"use client";

import type { TrendPoint } from "@/lib/analytics-types";

interface AnalyticsLineChartProps {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
}

export default function AnalyticsLineChart({
  title,
  subtitle,
  data,
}: AnalyticsLineChartProps) {
  const width = 520;
  const height = 220;
  const padX = 44;
  const padY = 28;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const maxVal = Math.max(...data.map((d) => d.value)) * 1.08;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const secPoints = data
    .filter((d) => d.secondary !== undefined)
    .map((d) => ({
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
            <span className="h-0.5 w-3 rounded bg-cyan-500" />
            Actions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-amber-400" style={{ opacity: 0.8 }} />
            Blocked
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="min-w-[300px]"
        >
          {[0, 0.5, 1].map((pct) => {
            const y = padY + chartH * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={pct}>
                <line
                  x1={padX}
                  y1={y}
                  x2={padX + chartW}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-600 text-[9px]"
                >
                  {(val / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          <path
            d={linePath}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {secPath && (
            <path
              d={secPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
          )}

          {points.map((p) => (
            <g key={p.label}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#06b6d4" />
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
