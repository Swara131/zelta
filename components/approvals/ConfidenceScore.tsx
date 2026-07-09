"use client";

interface ConfidenceScoreProps {
  score: number;
  size?: "sm" | "md";
}

export default function ConfidenceScore({ score, size = "md" }: ConfidenceScoreProps) {
  const radius = size === "sm" ? 18 : 24;
  const stroke = size === "sm" ? 3 : 4;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 95 ? "#34d399" : score >= 85 ? "#818cf8" : "#fbbf24";
  const dim = size === "sm" ? 44 : 56;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={normalizedRadius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={normalizedRadius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="confidence-ring transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono font-bold text-zinc-200 ${
            size === "sm" ? "text-[10px]" : "text-xs"
          }`}
        >
          {score}%
        </span>
      </div>
      {size === "md" && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Confidence
        </span>
      )}
    </div>
  );
}
