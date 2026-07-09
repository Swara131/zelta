import type { Integration } from "./integration-types";

export const DUMMY_INTEGRATIONS: Integration[] = [
  {
    id: "google-workspace",
    name: "Google Workspace",
    description:
      "Sync user directories, group memberships, and audit logs from Google Admin. Enable SSO and enforce domain-wide agent action policies.",
    category: "identity",
    status: "connected",
    logoKey: "google-workspace",
    brandColor: "#4285F4",
    connectedAt: "2026-05-12T09:00:00Z",
    lastSync: "2026-06-28T08:45:00Z",
  },
  {
    id: "microsoft-entra",
    name: "Microsoft Entra ID",
    description:
      "Connect Azure AD for identity governance, conditional access policies, and privileged identity management integration.",
    category: "identity",
    status: "connected",
    logoKey: "microsoft-entra",
    brandColor: "#0078D4",
    connectedAt: "2026-04-20T14:30:00Z",
    lastSync: "2026-06-28T09:00:00Z",
  },
  {
    id: "okta",
    name: "Okta",
    description:
      "Unified identity platform integration for SSO, MFA enforcement, and lifecycle management of agent service accounts.",
    category: "identity",
    status: "disconnected",
    logoKey: "okta",
    brandColor: "#007DC1",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Deliver real-time risk alerts and approval requests to Slack channels. Enable one-click approve/deny from notifications.",
    category: "collaboration",
    status: "connected",
    logoKey: "slack",
    brandColor: "#E01E5A",
    connectedAt: "2026-06-01T11:00:00Z",
    lastSync: "2026-06-28T10:05:00Z",
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    description:
      "Push approval workflows and security alerts to Teams channels with adaptive cards and @mention escalation.",
    category: "collaboration",
    status: "connected",
    logoKey: "microsoft-teams",
    brandColor: "#6264A7",
    connectedAt: "2026-05-28T16:00:00Z",
    lastSync: "2026-06-28T10:05:00Z",
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "Monitor agent actions on repositories, pull requests, and GitHub Actions workflows. Enforce branch protection approvals.",
    category: "devops",
    status: "disconnected",
    logoKey: "github",
    brandColor: "#f0f6fc",
  },
  {
    id: "aws",
    name: "AWS",
    description:
      "Ingest CloudTrail, IAM, and Secrets Manager events. Correlate agent actions with AWS resource access patterns.",
    category: "cloud",
    status: "connected",
    logoKey: "aws",
    brandColor: "#FF9900",
    connectedAt: "2026-03-15T10:00:00Z",
    lastSync: "2026-06-28T10:06:00Z",
  },
  {
    id: "azure",
    name: "Azure",
    description:
      "Connect Azure Monitor, Activity Logs, and Key Vault audit events for comprehensive cloud agent oversight.",
    category: "cloud",
    status: "pending",
    logoKey: "azure",
    brandColor: "#0078D4",
  },
  {
    id: "google-cloud",
    name: "Google Cloud",
    description:
      "Stream Cloud Audit Logs and IAM policy changes. Monitor agent access to GCP resources and service accounts.",
    category: "cloud",
    status: "disconnected",
    logoKey: "google-cloud",
    brandColor: "#4285F4",
  },
  {
    id: "splunk",
    name: "Splunk",
    description:
      "Forward agent action logs and approval events to Splunk SIEM. Enable correlation searches and compliance dashboards.",
    category: "siem",
    status: "error",
    logoKey: "splunk",
    brandColor: "#65A637",
  },
];

export const CATEGORY_LABELS = {
  identity: "Identity & Access",
  collaboration: "Collaboration",
  devops: "DevOps",
  cloud: "Cloud",
  siem: "SIEM & Logging",
} as const;

export const STATUS_CONFIG = {
  connected: { label: "Connected", color: "#34d399", dot: "bg-emerald-400" },
  disconnected: { label: "Not connected", color: "#71717a", dot: "bg-zinc-500" },
  pending: { label: "Connecting…", color: "#fbbf24", dot: "bg-amber-400 animate-pulse" },
  error: { label: "Connection error", color: "#f87171", dot: "bg-red-400" },
} as const;
