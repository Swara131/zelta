import type { RiskDistribution } from "@/lib/risk-types";
import { SEVERITY_COLORS } from "@/lib/risk/severity";

interface RiskSummaryCardsProps {
  distribution: RiskDistribution[];
}

export default function RiskSummaryCards({ distribution }: RiskSummaryCardsProps) {
  const order = ["critical", "high", "medium", "low"] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {order.map((severity) => {
        const item = distribution.find((d) => d.severity === severity);
        const count = item?.count ?? 0;
        const colors = SEVERITY_COLORS[severity];

        return (
          <div
            key={severity}
            className="defender-panel defender-severity-card p-4 transition-colors hover:border-white/12"
            style={{ borderLeftColor: colors.fill, borderLeftWidth: 3 }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.text }}
            >
              {item?.label ?? severity}
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">{count}</p>
            <p className="mt-0.5 text-xs text-zinc-600">detected</p>
          </div>
        );
      })}
    </div>
  );
}
