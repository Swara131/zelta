import type { RiskSeverity } from "@/lib/risk-types";
import { SEVERITY_COLORS } from "@/lib/risk/severity";

interface SeverityBadgeProps {
  severity: RiskSeverity;
  size?: "sm" | "md";
}

const LABELS: Record<RiskSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const colors = SEVERITY_COLORS[severity];

  return (
    <span
      className={`defender-badge inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide ${
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: size === "sm" ? 6 : 8,
          height: size === "sm" ? 6 : 8,
          background: colors.fill,
        }}
      />
      {LABELS[severity]}
    </span>
  );
}
