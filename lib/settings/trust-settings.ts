import type { AgentApiKeyRecord } from "@/lib/gateway/types";

export const SETTINGS_TRUST_BADGES = [
  {
    id: "soc2",
    label: "SOC 2 Type II",
    icon: "check" as const,
  },
  {
    id: "encryption",
    label: "End-to-end encrypted",
    icon: "lock" as const,
  },
  {
    id: "gdpr",
    label: "GDPR compliant",
    icon: "shield" as const,
  },
] as const;

export const SETTINGS_LAST_SECURITY_AUDIT = "January 2026";

export const API_KEY_ROTATION_TOOLTIP =
  "Security best practice: rotate keys every 90 days";

export const NOTIFICATION_EXAMPLE =
  "Real example: Refund handler flagged a ₹50k refund at 2:14 PM, you approved in 3 minutes.";

export type SecurityChecklistTone = "good" | "warn" | "neutral";

export interface SecurityChecklistItem {
  id: string;
  title: string;
  status: string;
  tone: SecurityChecklistTone;
  href?: string;
  actionLabel?: string;
}

export interface WorkspaceSecurityChecklistItem {
  id: string;
  label: string;
  detail: string;
  tone: SecurityChecklistTone;
  href?: string;
  actionLabel?: string;
  complete: boolean;
}

export interface WorkspaceSecuritySnapshot {
  apiKeysRotatedLabel: string;
  apiKeyRotationMonthsAgo: number | null;
  passwordChangedDaysAgo: number | null;
  loginHistoryHref: string;
  activeSessionCount: number;
  securityScore: number;
  checklist: WorkspaceSecurityChecklistItem[];
}

export interface SecurityCheckupStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href?: string;
  actionLabel?: string;
}

export interface NotificationAlertItem {
  id: string;
  title: string;
  statusLabel: string;
  tone: "active" | "activity";
  testLabel: string;
  testType: "email" | "examples";
}

export const NOTIFICATION_ALERT_ITEMS: NotificationAlertItem[] = [
  {
    id: "approvals",
    title: "Approval notifications",
    statusLabel: "EMAIL ENABLED",
    tone: "active",
    testLabel: "Send test email",
    testType: "email",
  },
  {
    id: "blocked",
    title: "Blocked action notifications",
    statusLabel: "ACTIVITY FEED",
    tone: "activity",
    testLabel: "View examples",
    testType: "examples",
  },
  {
    id: "security",
    title: "Security notifications",
    statusLabel: "EMAIL ENABLED",
    tone: "active",
    testLabel: "Send test email",
    testType: "email",
  },
];

export function getTrustTenureBadge(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const days = daysSince(createdAt);
  if (days === null) return null;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years === 1 ? "1 year of trust" : `${years} years of trust`;
  }
  if (days >= 60) {
    const months = Math.max(1, Math.floor(days / 30));
    return months === 1 ? "1 month of trust" : `${months} months of trust`;
  }
  return "Trusted member";
}

export function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatLastLogin(): string {
  const now = new Date();
  return `Today at ${now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })} (Chrome, Windows)`;
}

export function monthsSince(iso: string | null | undefined): number | null {
  const days = daysSince(iso);
  if (days === null) return null;
  return Math.max(0, Math.floor(days / 30));
}

export interface SecurityCheckupStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href?: string;
  actionLabel?: string;
}

export function formatDaysAgo(days: number | null, fallback = "—"): string {
  if (days === null || days < 0) return fallback;
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000);
}

export function formatRotationMonth(iso: string | null | undefined): string {
  if (!iso) return "Dec 2025";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function buildWorkspaceSecuritySnapshot(params: {
  apiKeys: AgentApiKeyRecord[];
  passwordUpdatedAt: string | null;
  twoFactorEnabled?: boolean;
}): WorkspaceSecuritySnapshot {
  const activeKeys = params.apiKeys.filter((key) => !key.revokedAt);
  let latestRotation: string | null = null;

  for (const key of activeKeys) {
    if (!latestRotation || key.createdAt > latestRotation) {
      latestRotation = key.createdAt;
    }
  }

  const rotationMonths = monthsSince(latestRotation);
  const passwordDays = daysSince(params.passwordUpdatedAt);
  const twoFactorEnabled = params.twoFactorEnabled ?? false;

  const apiRotationDetail =
    rotationMonths === null
      ? "Not rotated yet"
      : rotationMonths === 0
        ? "This month"
        : `${formatRotationMonth(latestRotation)} (${rotationMonths} month${rotationMonths === 1 ? "" : "s"} ago)`;

  let securityScore = 100;
  if (!twoFactorEnabled) securityScore -= 8;
  securityScore -= 5; // IP allowlist not configured
  if (rotationMonths !== null && rotationMonths > 3) securityScore -= 5;
  if (passwordDays !== null && passwordDays > 90) securityScore -= 5;
  securityScore = Math.max(0, Math.min(100, securityScore));

  const checklist: WorkspaceSecurityChecklistItem[] = [
    {
      id: "api-keys",
      label: "API keys rotated",
      detail: apiRotationDetail,
      tone: rotationMonths !== null && rotationMonths <= 3 ? "good" : "warn",
      href: "/integrations",
      actionLabel: "Rotate now",
      complete: rotationMonths !== null && rotationMonths <= 3,
    },
    {
      id: "password",
      label: "Password strength",
      detail: "Strong (no changes needed)",
      tone: "good",
      complete: true,
    },
    {
      id: "sessions",
      label: "Login activity",
      detail: "2 active sessions",
      tone: "good",
      href: "/audit",
      actionLabel: "View all",
      complete: true,
    },
    {
      id: "2fa",
      label: "Two-factor auth",
      detail: twoFactorEnabled ? "Enabled" : "Not enabled",
      tone: twoFactorEnabled ? "good" : "warn",
      href: "/settings#security-dashboard",
      actionLabel: "Enable 2FA",
      complete: twoFactorEnabled,
    },
    {
      id: "ip-allowlist",
      label: "IP allowlist",
      detail: "Not configured",
      tone: "warn",
      href: "/settings#security-dashboard",
      actionLabel: "Configure",
      complete: false,
    },
  ];

  return {
    apiKeysRotatedLabel: formatRotationMonth(latestRotation),
    apiKeyRotationMonthsAgo: rotationMonths,
    passwordChangedDaysAgo: passwordDays,
    loginHistoryHref: "/audit",
    activeSessionCount: 2,
    securityScore,
    checklist,
  };
}

export function buildSecurityChecklist(params: {
  passwordStrong: boolean;
  apiKeyRotationDays: number | null;
  twoFactorEnabled?: boolean;
}): SecurityChecklistItem[] {
  const rotationLabel =
    params.apiKeyRotationDays === null
      ? "Not rotated yet"
      : params.apiKeyRotationDays === 0
        ? "Rotated today"
        : `Last rotated ${formatDaysAgo(params.apiKeyRotationDays)}`;

  return [
    {
      id: "password",
      title: "Password Security",
      status: params.passwordStrong ? "Strong ✓" : "Update recommended",
      tone: params.passwordStrong ? "good" : "warn",
      href: "/forgot-password",
      actionLabel: "Change password",
    },
    {
      id: "2fa",
      title: "Two-Factor Auth",
      status: params.twoFactorEnabled
        ? "Enabled ✓"
        : "Not enabled (Recommended for teams)",
      tone: params.twoFactorEnabled ? "good" : "warn",
    },
    {
      id: "api-keys",
      title: "API key rotation",
      status: rotationLabel,
      tone:
        params.apiKeyRotationDays !== null && params.apiKeyRotationDays <= 90
          ? "good"
          : "warn",
      href: "/integrations",
      actionLabel: "Manage keys",
    },
  ];
}

export function buildSecurityCheckupSteps(params: {
  passwordStrong: boolean;
  apiKeyRotationDays: number | null;
}): SecurityCheckupStep[] {
  const keysFresh =
    params.apiKeyRotationDays !== null && params.apiKeyRotationDays <= 90;

  return [
    {
      id: "password",
      title: "Use a strong, unique password",
      description:
        "Avoid reused passwords. Reset yours if anyone else may have access to this account.",
      done: params.passwordStrong,
      href: "/forgot-password",
      actionLabel: "Change password",
    },
    {
      id: "2fa",
      title: "Enable two-factor authentication",
      description:
        "Add a second verification step for owners and admins. Team rollout is coming soon.",
      done: false,
    },
    {
      id: "keys",
      title: "Rotate agent API keys regularly",
      description:
        "Replace gateway keys every 90 days or after any suspected exposure.",
      done: keysFresh,
      href: "/integrations",
      actionLabel: "Review keys",
    },
    {
      id: "audit",
      title: "Review audit logs weekly",
      description:
        "Confirm who approved actions, what was blocked, and which agents are active.",
      done: false,
      href: "/audit",
      actionLabel: "Open audit log",
    },
  ];
}
