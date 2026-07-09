"use client";

import type { RiskTrendPoint } from "@/lib/risk-types";

interface RiskLineChartProps {
  data: RiskTrendPoint[];
}

export default function RiskLineChart({ data }: RiskLineChartProps) {
  const width = 480;
  const height = 200;
  const padX = 40;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const maxScore = 100;
  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - (d.score / maxScore) * chartH,
    ...d,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + chartH} L ${points[0].x} ${padY + chartH} Z`;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="defender-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="defender-panel-title">Risk Trend</p>
        <span className="text-xs text-zinc-500">Last 7 days</span>
      </div>

      <div className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="min-w-[320px]"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0078d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0078d4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((val) => {
            const y = padY + chartH - (val / maxScore) * chartH;
            return (
              <g key={val}>
                <line
                  x1={padX}
                  y1={y}
                  x2={padX + chartW}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray={val === 0 ? "0" : "4 4"}
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-600 text-[10px]"
                >
                  {val}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#trendGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#0078d4"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p) => (
            <g key={p.date}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#141414"
                stroke="#0078d4"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={padY + chartH + 16}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px]"
              >
                {p.date}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex items-center gap-4 border-t border-white/6 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded bg-[#0078d4]" />
          <span className="text-xs text-zinc-500">Overall Risk Score</span>
        </div>
        <span className="ml-auto font-mono text-xs text-zinc-400">
          Δ +{data[data.length - 1].score - data[0].score} pts this week
        </span>
      </div>
    </div>
  );
}
