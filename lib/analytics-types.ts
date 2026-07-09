export interface AnalyticsKPI {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  trend: "up" | "down" | "neutral";
}

export interface TrendPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface UserRank {
  name: string;
  department: string;
  count: number;
  riskScore?: number;
  avatar: string;
}

export interface DepartmentStat {
  name: string;
  actions: number;
  blocked: number;
  approvalRate: number;
  color: string;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  value: number;
}

export interface ActivityItem {
  id: string;
  type: "approved" | "blocked" | "escalated" | "upload" | "risk" | "rejected";
  title: string;
  description: string;
  actor: string;
  timestamp: string;
}

export interface AnalyticsData {
  kpis: {
    todaysActions: AnalyticsKPI;
    blockedActions: AnalyticsKPI;
    approvalTime: AnalyticsKPI;
    successRate: AnalyticsKPI;
  };
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  departmentPie: PieSlice[];
  actionTypePie: PieSlice[];
  topRiskyUsers: UserRank[];
  mostActiveUsers: UserRank[];
  departments: DepartmentStat[];
  heatmap: HeatmapCell[];
  recentActivity: ActivityItem[];
}
