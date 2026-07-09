export const DEPARTMENT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#34d399",
  "#fbbf24",
  "#71717a",
  "#f472b6",
  "#fb923c",
] as const;

export const ACTION_PIE_COLORS: Record<string, string> = {
  Approved: "#34d399",
  "Auto-approved": "#60a5fa",
  Blocked: "#f87171",
  Pending: "#fbbf24",
  Escalated: "#fb923c",
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
