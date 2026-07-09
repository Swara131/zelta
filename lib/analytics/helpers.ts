import type { AnalyticsKPI } from "@/lib/analytics-types";
import type { RiskSeverity } from "@/lib/risk-types";

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pctChange(
  current: number,
  previous: number
): { change: number; trend: AnalyticsKPI["trend"] } {
  if (previous === 0) {
    if (current === 0) return { change: 0, trend: "neutral" };
    return { change: 100, trend: "up" };
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  if (Math.abs(delta) < 0.05) return { change: 0, trend: "neutral" };
  return { change: rounded, trend: delta > 0 ? "up" : "down" };
}

export function buildKpi(
  label: string,
  value: string | number,
  current: number,
  previous: number,
  changeLabel: string
): AnalyticsKPI {
  const { change, trend } = pctChange(current, previous);
  return { label, value, change, changeLabel, trend };
}

export function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9._-]/g, " ").split(/[\s._@-]+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const SEVERITY_SCORE: Record<RiskSeverity, number> = {
  critical: 95,
  high: 78,
  medium: 55,
  low: 30,
};

export function severityToRiskScore(severity: RiskSeverity): number {
  return SEVERITY_SCORE[severity];
}

export function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return SEVERITY_SCORE[a] >= SEVERITY_SCORE[b] ? a : b;
}
