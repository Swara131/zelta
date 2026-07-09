export type RiskSeverity = "critical" | "high" | "medium" | "low";

export interface RelatedEvent {
  id: string;
  title: string;
  timestamp: string;
  severity: RiskSeverity;
}

export interface DetectedRisk {
  id: string;
  title: string;
  severity: RiskSeverity;
  explanation: string;
  businessImpact: string;
  complianceImpact: string;
  mitreAttack: {
    tactic: string;
    technique: string;
    techniqueId: string;
  };
  owaspCategory: string;
  suggestedAction: string;
  confidence: number;
  aiRecommendation: string;
  relatedEvents: RelatedEvent[];
  detectedAt: string;
  sourceLog: string;
}

export interface RiskTrendPoint {
  date: string;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RiskDistribution {
  severity: RiskSeverity;
  count: number;
  label: string;
}

export interface RiskAnalysisSummary {
  overallScore: number;
  riskLevel: RiskSeverity;
  totalDetected: number;
  analyzedLogs: number;
  lastUpdated: string;
  distribution: RiskDistribution[];
  trend: RiskTrendPoint[];
  risks: DetectedRisk[];
}
