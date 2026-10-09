import type { FounderUsageItem } from "@/lib/billing/founder-billing-copy";

interface UsagePanelProps {
  usage: FounderUsageItem[];
  loading?: boolean;
}

function UsageBar({ metric }: { metric: FounderUsageItem }) {
  const pct = Math.min((metric.used / metric.limit) * 100, 100);
  const isHigh = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="bill-usage-item">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--ds-text-primary)]">
          {metric.label}
        </span>
        <span className="text-sm text-[var(--ds-text-secondary)]">
          {metric.used.toLocaleString()}
          <span className="text-[var(--ds-text-tertiary)]">
            {" "}
            / {metric.limit.toLocaleString()}
          </span>
        </span>
      </div>

      <div className="stripe-usage-track h-2 overflow-hidden rounded-full">
        <div
          className="stripe-usage-fill h-full rounded-full"
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

      <p className="mt-1.5 text-xs text-[var(--ds-text-secondary)]">
        {metric.helperText}
      </p>
      <p className="mt-1 text-xs text-[var(--ds-text-tertiary)]">{metric.explanation}</p>
    </div>
  );
}

export default function UsagePanel({ usage, loading }: UsagePanelProps) {
  return (
    <div className="bill-panel ds-panel p-6">
      <h3 className="bill-section-title">Your usage</h3>
      <p className="bill-section-desc mt-1">
        How much of your plan you&apos;ve used this billing period.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--ds-text-tertiary)]">Loading usage…</p>
      ) : usage.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--ds-text-secondary)]">
          Usage data will appear here once your agents start taking protected actions.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {usage.map((metric) => (
            <UsageBar key={metric.label} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
}
