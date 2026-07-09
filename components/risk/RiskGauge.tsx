"use client";

import { getRiskLevelLabel } from "@/lib/dummy-risk-data";
import { SEVERITY_COLORS } from "@/lib/risk/severity";
import type { RiskSeverity } from "@/lib/risk-types";

interface RiskGaugeProps {
  score: number;
  level: RiskSeverity;
}

export default function RiskGauge({ score, level }: RiskGaugeProps) {
  const colors = SEVERITY_COLORS[level];
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arc = circumference * 0.75;
  const offset = arc - (score / 100) * arc;

  const label = getRiskLevelLabel(score);

  return (
    <div className="defender-panel flex flex-col items-center justify-center p-6">
      <p className="defender-panel-title mb-4 self-start">Overall Risk Score</p>

      <div className="relative">
        <svg width="200" height="160" viewBox="0 0 200 160" className="overflow-visible">
          {/* Background arc */}
          <circle
            cx="100"
            cy="100"
            r={normalizedRadius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(135 100 100)"
          />
          {/* Score arc */}
          <circle
            cx="100"
            cy="100"
            r={normalizedRadius}
            fill="none"
            stroke={colors.fill}
            strokeWidth={stroke}
            strokeDasharray={`${arc - offset} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(135 100 100)"
            className="gauge-arc transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${colors.fill}66)`,
            }}
          />
          {/* Score text */}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="fill-white text-4xl font-bold"
            style={{ fontFamily: "var(--font-geist-sans)" }}
          >
            {score}
          </text>
          <text
            x="100"
            y="118"
            textAnchor="middle"
            className="text-sm font-semibold uppercase tracking-wider"
            fill={colors.text}
          >
            {label}
          </text>
        </svg>
      </div>

      <div className="mt-2 flex w-full justify-between px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <span>0</span>
        <span>Low</span>
        <span>Med</span>
        <span>High</span>
        <span>100</span>
      </div>
    </div>
  );
}
