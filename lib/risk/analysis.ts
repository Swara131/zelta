import type { TranslatedAction } from "@/lib/translator-types";
import type {
  DetectedRisk,
  RiskAnalysisSummary,
  RiskDistribution,
  RiskSeverity,
  RiskTrendPoint,
} from "@/lib/risk-types";
import { getRiskLevelSeverity } from "@/lib/dummy-risk-data";

const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface RiskAnalysisRecord {
  id: string;
  user_id: string;
  organization_id: string;
  uploaded_log_id: string | null;
  overall_score: number;
  risk_level: RiskSeverity;
  total_detected: number;
  analyzed_logs: number;
  distribution: RiskDistribution[];
  risks: DetectedRisk[];
  model: string | null;
  created_at: string;
}

export interface TranslatorSessionRecord {
  id: string;
  user_id: string;
  filename: string | null;
  log_content: string;
  translations: TranslatedAction[];
  created_at: string;
}

export function computeDistribution(risks: DetectedRisk[]): RiskDistribution[] {
  const counts: Record<RiskSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const risk of risks) {
    counts[risk.severity] += 1;
  }

  return (Object.keys(counts) as RiskSeverity[]).map((severity) => ({
    severity,
    count: counts[severity],
    label: SEVERITY_LABELS[severity],
  }));
}

export function sortRisksBySeverity(risks: DetectedRisk[]): DetectedRisk[] {
  return [...risks].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

export function buildTrendFromHistory(
  records: RiskAnalysisRecord[]
): RiskTrendPoint[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return sorted.slice(-7).map((record) => {
    const distribution = record.distribution as RiskDistribution[];
    const findCount = (severity: RiskSeverity) =>
      distribution.find((d) => d.severity === severity)?.count ?? 0;

    return {
      date: new Date(record.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: record.overall_score,
      critical: findCount("critical"),
      high: findCount("high"),
      medium: findCount("medium"),
      low: findCount("low"),
    };
  });
}

export function toRiskAnalysisSummary(
  record: RiskAnalysisRecord,
  trendRecords: RiskAnalysisRecord[]
): RiskAnalysisSummary {
  const risks = sortRisksBySeverity(record.risks as DetectedRisk[]);
  const trend = buildTrendFromHistory(trendRecords);

  return {
    overallScore: record.overall_score,
    riskLevel: record.risk_level,
    totalDetected: record.total_detected,
    analyzedLogs: record.analyzed_logs,
    lastUpdated: record.created_at,
    distribution: record.distribution as RiskDistribution[],
    trend: trend.length > 0 ? trend : buildTrendFromHistory([record]),
    risks,
  };
}

export function deriveOverallScore(risks: DetectedRisk[]): {
  overallScore: number;
  riskLevel: RiskSeverity;
} {
  if (risks.length === 0) {
    return { overallScore: 0, riskLevel: "low" };
  }

  const weights: Record<RiskSeverity, number> = {
    critical: 95,
    high: 75,
    medium: 50,
    low: 25,
  };

  const totalWeight = risks.reduce((sum, risk) => sum + weights[risk.severity], 0);
  const overallScore = Math.min(
    100,
    Math.max(0, Math.round(totalWeight / risks.length))
  );

  return {
    overallScore,
    riskLevel: getRiskLevelSeverity(overallScore),
  };
}
