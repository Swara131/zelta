import type { NotificationItem } from "./notification-types";

export const DUMMY_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-001",
    risk: "Unauthorized Production Secrets Access",
    riskId: "risk-001",
    timestamp: "2026-06-28T10:06:10Z",
    severity: "critical",
    status: "unread",
    recipient: "Sarah Chen",
    recipientEmail: "sarah.chen@company.com",
    channel: "email",
    deliveryStatus: "delivered",
    subject: "[CRITICAL] Agent secret access requires approval — agent-001",
    preview: `Hi Sarah,

A critical risk has been detected requiring your immediate review.

Risk: Unauthorized Production Secrets Access
Agent: agent-001
Action: GetSecretValue on prod/db/credentials
Severity: CRITICAL
Confidence: 95%

Recommended Action: Deny direct secret access. Approve only with JIT credential broker.

Review in ApprovalLayer: https://approvalayer.app/approvals/apr-001

— ApprovalLayer Security Alerts`,
    retryCount: 0,
    maxRetries: 3,
  },
  {
    id: "notif-002",
    risk: "Unapproved Privilege Escalation",
    riskId: "risk-002",
    timestamp: "2026-06-28T10:05:42Z",
    severity: "critical",
    status: "unread",
    recipient: "#security-alerts",
    channel: "slack",
    deliveryStatus: "delivered",
    subject: "Critical: Unauthorized admin permission grant",
    preview: `:rotating_light: *Critical Risk Detected*

*Unapproved Privilege Escalation*
Agent \`agent-003\` attempted to grant \`admin:write\` to alex.rivera@company.com

• Severity: CRITICAL
• MITRE: T1098 Account Manipulation
• SLA: 3h 30m remaining

<https://approvalayer.app/approvals/apr-002|Review Now>`,
    retryCount: 0,
    maxRetries: 3,
  },
  {
    id: "notif-003",
    risk: "Bulk Admin User Database Query",
    riskId: "risk-004",
    timestamp: "2026-06-28T10:05:05Z",
    severity: "high",
    status: "unread",
    recipient: "Security Team",
    channel: "teams",
    deliveryStatus: "delivered",
    subject: "High risk: Admin user enumeration query",
    preview: `**High Risk Alert — Approval Required**

Agent agent-003 executed a SQL query returning 47 admin-role users from production database.

**Affected System:** PostgreSQL — production-db-primary
**Compliance:** GDPR Art. 5(1)(c) data minimization

[Open in ApprovalLayer](https://approvalayer.app/approvals/apr-003)`,
    retryCount: 0,
    maxRetries: 3,
  },
  {
    id: "notif-004",
    risk: "Sensitive System File Access",
    riskId: "risk-003",
    timestamp: "2026-06-28T10:00:15Z",
    severity: "high",
    status: "read",
    recipient: "Marcus Webb",
    recipientEmail: "marcus.webb@company.com",
    channel: "email",
    deliveryStatus: "delivered",
    subject: "[HIGH] Sensitive file read detected — agent-001",
    preview: `Hi Marcus,

Agent agent-001 read /etc/passwd on production node prod-web-03 running as root (UID 0).

This may indicate reconnaissance behavior preceding credential theft.

Review: https://approvalayer.app/approvals

— ApprovalLayer`,
    retryCount: 0,
    maxRetries: 3,
  },
  {
    id: "notif-005",
    risk: "Shell Command on Deploy Runner",
    riskId: "risk-005",
    timestamp: "2026-06-28T09:58:05Z",
    severity: "medium",
    status: "read",
    recipient: "#devops-approvals",
    channel: "slack",
    deliveryStatus: "failed",
    subject: "Medium risk: Unrestricted shell execution",
    preview: `:warning: *Medium Risk — Shell Command Execution*

Agent \`agent-002\` executed \`git status\` on deploy runner #12.

Unrestricted shell_exec capability detected. Review recommended.

<https://approvalayer.app/approvals/apr-004|Review>`,
    retryCount: 2,
    maxRetries: 3,
  },
  {
    id: "notif-006",
    risk: "External API Data Retrieval",
    riskId: "risk-006",
    timestamp: "2026-06-28T09:15:30Z",
    severity: "low",
    status: "read",
    recipient: "Compliance Team",
    channel: "teams",
    deliveryStatus: "pending",
    subject: "Info: External API request within policy scope",
    preview: `**Low Risk — Informational**

Agent agent-001 made GET request to api.example.com/v2/users (HTTP 200).

Action is within documented API access scope. No immediate action required.`,
    retryCount: 0,
    maxRetries: 3,
  },
  {
    id: "notif-007",
    risk: "Unauthorized Production Secrets Access",
    riskId: "risk-001",
    timestamp: "2026-06-28T10:06:12Z",
    severity: "critical",
    status: "unread",
    recipient: "CISO On-Call",
    recipientEmail: "ciso-oncall@company.com",
    channel: "email",
    deliveryStatus: "bounced",
    subject: "[CRITICAL] Escalated: Production secret access — agent-001",
    preview: `ESCALATION NOTICE

Critical risk escalated to CISO on-call rotation.

Risk: Unauthorized Production Secrets Access
Original assignee: Sarah Chen
Escalation reason: SLA breach imminent

Immediate action required.`,
    retryCount: 3,
    maxRetries: 3,
  },
  {
    id: "notif-008",
    risk: "Unapproved Privilege Escalation",
    riskId: "risk-002",
    timestamp: "2026-06-28T10:05:45Z",
    severity: "critical",
    status: "read",
    recipient: "Alex Rivera",
    recipientEmail: "alex.rivera@company.com",
    channel: "email",
    deliveryStatus: "delivered",
    subject: "[CRITICAL] Permission grant attempt flagged",
    preview: `Hi Alex,

Your account was referenced in a critical security event.

An AI agent attempted to grant admin:write scope to your account without approved authorization.

If you did not request this access, contact Security immediately.

— ApprovalLayer Security`,
    retryCount: 0,
    maxRetries: 3,
  },
];

export const CHANNEL_CONFIG = {
  email: { label: "Email", color: "#60a5fa", icon: "mail" },
  slack: { label: "Slack", color: "#e879f9", icon: "slack" },
  teams: { label: "Teams", color: "#818cf8", icon: "teams" },
} as const;

export const DELIVERY_CONFIG = {
  delivered: { label: "Delivered", color: "#34d399" },
  pending: { label: "Pending", color: "#fbbf24" },
  failed: { label: "Failed", color: "#f87171" },
  bounced: { label: "Bounced", color: "#fb923c" },
  retrying: { label: "Retrying", color: "#a78bfa" },
} as const;

export const STATUS_CONFIG = {
  unread: { label: "Unread", color: "#818cf8" },
  read: { label: "Read", color: "#71717a" },
  archived: { label: "Archived", color: "#52525b" },
} as const;
