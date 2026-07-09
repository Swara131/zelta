import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AnalyticsKPI } from "@/lib/analytics-types";

interface MetricCardProps {
  kpi: AnalyticsKPI;
  icon: LucideIcon;
  accent: string;
}

export default function MetricCard({ kpi, icon: Icon, accent }: MetricCardProps) {
  const TrendIcon =
    kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;

  const changePositive =
    (kpi.trend === "up" && kpi.label !== "Blocked Actions" && kpi.label !== "Avg. Approval Time") ||
    (kpi.trend === "down" && (kpi.label === "Blocked Actions" || kpi.label === "Avg. Approval Time"));

  return (
    <div className="ds-panel ds-card-interactive group p-5">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-sm)] ring-1 ring-[var(--ds-border)]"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div
          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
            changePositive
              ? "bg-emerald-500/10 text-emerald-400"
              : kpi.trend === "neutral"
                ? "bg-zinc-500/10 text-zinc-400"
                : "bg-red-500/10 text-red-400"
          }`}
        >
          <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
          {Math.abs(kpi.change)}%
        </div>
      </div>

      <p className="ds-stat-label mt-4">{kpi.label}</p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-[var(--ds-text-primary)]">
        {kpi.value}
      </p>
      <p className="mt-1 ds-caption">{kpi.changeLabel}</p>
    </div>
  );
}
