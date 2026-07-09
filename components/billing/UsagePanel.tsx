import type { UsageMetric } from "@/lib/billing-types";

interface UsagePanelProps {
  usage: UsageMetric[];
  planName: string;
}

function UsageBar({ metric }: { metric: UsageMetric }) {
  const pct = Math.min((metric.used / metric.limit) * 100, 100);
  const isHigh = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{metric.label}</span>
        <span className="font-mono text-sm text-zinc-400">
          {metric.used.toLocaleString()}
          <span className="text-zinc-600">
            {" "}
            / {metric.limit.toLocaleString()} {metric.unit}
          </span>
        </span>
      </div>
      <div className="stripe-usage-track h-2 overflow-hidden rounded-full">
        <div
          className="stripe-usage-fill h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: isCritical
              ? "linear-gradient(90deg, #f87171, #fb923c)"
              : isHigh
                ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                : "linear-gradient(90deg, #635BFF, #818cf8)",
          }}
        />
      </div>
      {isHigh && (
        <p className="mt-1.5 text-xs text-amber-400/80">
          {isCritical ? "Limit almost reached — upgrade recommended" : "Approaching limit"}
        </p>
      )}
    </div>
  );
}

export default function UsagePanel({ usage, planName }: UsagePanelProps) {
  return (
    <div className="stripe-panel p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="stripe-panel-title">Usage</p>
          <p className="mt-0.5 text-xs text-zinc-500">{planName} plan · Resets monthly</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {usage.map((metric) => (
          <UsageBar key={metric.label} metric={metric} />
        ))}
      </div>
    </div>
  );
}
