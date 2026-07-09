import type { RiskSeverity } from "@/lib/risk-types";

export const SEVERITY_COLORS: Record<
  RiskSeverity,
  { fill: string; bg: string; border: string; text: string }
> = {
  critical: {
    fill: "#ff4769",
    bg: "rgba(255, 71, 105, 0.12)",
    border: "rgba(255, 71, 105, 0.3)",
    text: "#ff4769",
  },
  high: {
    fill: "#ff8c00",
    bg: "rgba(255, 140, 0, 0.12)",
    border: "rgba(255, 140, 0, 0.3)",
    text: "#ff8c00",
  },
  medium: {
    fill: "#ffb900",
    bg: "rgba(255, 185, 0, 0.12)",
    border: "rgba(255, 185, 0, 0.3)",
    text: "#ffb900",
  },
  low: {
    fill: "#00bcf2",
    bg: "rgba(0, 188, 242, 0.12)",
    border: "rgba(0, 188, 242, 0.3)",
    text: "#00bcf2",
  },
};

export function getRiskLevelLabel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function getRiskLevelSeverity(
  score: number
): "critical" | "high" | "medium" | "low" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}
