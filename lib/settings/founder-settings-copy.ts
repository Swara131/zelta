export type NotificationSettingStatus = "active" | "activity" | "channel";

export interface NotificationSettingItem {
  id: string;
  title: string;
  description: string;
  status: NotificationSettingStatus;
  statusLabel: string;
}

export const NOTIFICATION_SETTINGS: NotificationSettingItem[] = [
  {
    id: "approvals",
    title: "Approval alerts",
    description:
      "Instant email when an agent action needs your review or approval.",
    status: "active",
    statusLabel: "Email enabled",
  },
  {
    id: "blocked",
    title: "Blocked action alerts",
    description:
      "High-risk blocks appear in Agent Activity immediately; email summaries follow for admins.",
    status: "activity",
    statusLabel: "Real-time feed",
  },
  {
    id: "security",
    title: "Security alerts",
    description:
      "Email when critical risk is detected during gateway evaluation or log analysis.",
    status: "active",
    statusLabel: "Email enabled",
  },
  {
    id: "email",
    title: "Email delivery",
    description:
      "Time-sensitive actions reach you instantly via email. Delivery history is in Alerts.",
    status: "channel",
    statusLabel: "Primary channel",
  },
];

export function formatOrgRole(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Member";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}

export function formatAccountDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
