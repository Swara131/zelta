import type { AnalyticsData } from "./analytics-types";

export const DUMMY_ANALYTICS: AnalyticsData = {
  kpis: {
    todaysActions: {
      label: "Today's Actions",
      value: 847,
      change: 12.4,
      changeLabel: "vs yesterday",
      trend: "up",
    },
    blockedActions: {
      label: "Blocked Actions",
      value: 34,
      change: -8.2,
      changeLabel: "vs yesterday",
      trend: "down",
    },
    approvalTime: {
      label: "Avg. Approval Time",
      value: "2h 18m",
      change: -15.3,
      changeLabel: "vs last week",
      trend: "down",
    },
    successRate: {
      label: "Approval Success Rate",
      value: "94.2%",
      change: 2.1,
      changeLabel: "vs last month",
      trend: "up",
    },
  },
  weeklyTrend: [
    { label: "Mon", value: 612, secondary: 28 },
    { label: "Tue", value: 734, secondary: 31 },
    { label: "Wed", value: 689, secondary: 24 },
    { label: "Thu", value: 812, secondary: 35 },
    { label: "Fri", value: 756, secondary: 29 },
    { label: "Sat", value: 423, secondary: 12 },
    { label: "Sun", value: 398, secondary: 9 },
  ],
  monthlyTrend: [
    { label: "Jan", value: 8420, secondary: 412 },
    { label: "Feb", value: 9100, secondary: 389 },
    { label: "Mar", value: 8850, secondary: 445 },
    { label: "Apr", value: 10200, secondary: 398 },
    { label: "May", value: 11400, secondary: 421 },
    { label: "Jun", value: 12847, secondary: 387 },
  ],
  departmentPie: [
    { label: "Engineering", value: 3420, color: "#6366f1" },
    { label: "Security", value: 2180, color: "#8b5cf6" },
    { label: "DevOps", value: 1890, color: "#06b6d4" },
    { label: "Compliance", value: 1240, color: "#34d399" },
    { label: "Operations", value: 980, color: "#fbbf24" },
    { label: "Other", value: 537, color: "#71717a" },
  ],
  actionTypePie: [
    { label: "Approved", value: 12104, color: "#34d399" },
    { label: "Auto-approved", value: 3842, color: "#60a5fa" },
    { label: "Blocked", value: 892, color: "#f87171" },
    { label: "Pending", value: 234, color: "#fbbf24" },
    { label: "Escalated", value: 175, color: "#fb923c" },
  ],
  topRiskyUsers: [
    { name: "alex.rivera", department: "Engineering", count: 47, riskScore: 91, avatar: "AR" },
    { name: "agent-003", department: "Automation", count: 38, riskScore: 87, avatar: "A3" },
    { name: "marcus.webb", department: "Security", count: 29, riskScore: 78, avatar: "MW" },
    { name: "agent-001", department: "Automation", count: 24, riskScore: 74, avatar: "A1" },
    { name: "sarah.chen", department: "DevOps", count: 19, riskScore: 68, avatar: "SC" },
  ],
  mostActiveUsers: [
    { name: "agent-001", department: "Automation", count: 2847, avatar: "A1" },
    { name: "agent-002", department: "Automation", count: 2103, avatar: "A2" },
    { name: "agent-003", department: "Automation", count: 1892, avatar: "A3" },
    { name: "deploy-bot", department: "DevOps", count: 1240, avatar: "DB" },
    { name: "audit-bot", department: "Compliance", count: 987, avatar: "AB" },
  ],
  departments: [
    { name: "Engineering", actions: 3420, blocked: 142, approvalRate: 95.8, color: "#6366f1" },
    { name: "Security", actions: 2180, blocked: 89, approvalRate: 95.9, color: "#8b5cf6" },
    { name: "DevOps", actions: 1890, blocked: 67, approvalRate: 96.5, color: "#06b6d4" },
    { name: "Compliance", actions: 1240, blocked: 34, approvalRate: 97.3, color: "#34d399" },
    { name: "Operations", actions: 980, blocked: 41, approvalRate: 95.8, color: "#fbbf24" },
  ],
  heatmap: generateHeatmap(),
  recentActivity: [
    {
      id: "act-1",
      type: "blocked",
      title: "Production secret access blocked",
      description: "agent-001 denied GetSecretValue on prod/db/credentials",
      actor: "Approval Engine",
      timestamp: "2026-06-28T10:06:05Z",
    },
    {
      id: "act-2",
      type: "risk",
      title: "Critical risk detected",
      description: "T1098 Account Manipulation — admin grant attempt",
      actor: "Risk Classifier",
      timestamp: "2026-06-28T10:05:38Z",
    },
    {
      id: "act-3",
      type: "escalated",
      title: "Approval escalated to CISO",
      description: "Unauthorized permission grant — apr-002",
      actor: "Marcus Webb",
      timestamp: "2026-06-28T10:04:12Z",
    },
    {
      id: "act-4",
      type: "approved",
      title: "Shell command approved with conditions",
      description: "git status allowlisted for agent-002",
      actor: "Sarah Chen",
      timestamp: "2026-06-28T09:58:00Z",
    },
    {
      id: "act-5",
      type: "upload",
      title: "Log batch uploaded",
      description: "agent-actions-2026-06-28.jsonl — 847 entries",
      actor: "Sarah Chen",
      timestamp: "2026-06-28T09:45:00Z",
    },
    {
      id: "act-6",
      type: "rejected",
      title: "Bulk query rejected",
      description: "Admin enumeration query denied — insufficient justification",
      actor: "Alex Rivera",
      timestamp: "2026-06-28T09:30:00Z",
    },
    {
      id: "act-7",
      type: "approved",
      title: "API request auto-approved",
      description: "GET api.example.com/v2/users — within policy scope",
      actor: "Approval Engine",
      timestamp: "2026-06-28T09:15:00Z",
    },
  ],
};

function generateHeatmap() {
  const cells: { day: number; hour: number; value: number }[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let base = 20;
      if (day >= 1 && day <= 5) base += 30;
      if (hour >= 9 && hour <= 17) base += 40;
      if (hour >= 10 && hour <= 14) base += 20;
      const noise = Math.sin(day * 3 + hour * 0.7) * 15 + Math.cos(day + hour) * 10;
      cells.push({
        day,
        hour,
        value: Math.max(5, Math.round(base + noise)),
      });
    }
  }
  return cells;
}

export const HEATMAP_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ACTIVITY_TYPE_CONFIG = {
  approved: { color: "#34d399", label: "Approved" },
  blocked: { color: "#f87171", label: "Blocked" },
  escalated: { color: "#fb923c", label: "Escalated" },
  upload: { color: "#60a5fa", label: "Upload" },
  risk: { color: "#ff4769", label: "Risk" },
  rejected: { color: "#f87171", label: "Rejected" },
} as const;
