import type { PendingApproval } from "./approval-types";

export const DUMMY_PENDING_APPROVALS: PendingApproval[] = [
  {
    id: "apr-001",
    title: "Production Database Credentials Access",
    agentId: "agent-001",
    riskSeverity: "critical",
    priority: "p1",
    aiExplanation:
      "Agent agent-001 invoked GetSecretValue on AWS Secrets Manager for prod/db/credentials without a linked change ticket. The action occurred during an automated deployment workflow but lacks the required security approval gate for production secret access.",
    businessJustification:
      "Deployment pipeline requires database credentials to run migration scripts. However, production secret access should use JIT credentials with 15-minute TTL rather than static secret retrieval.",
    affectedSystems: [
      "AWS Secrets Manager",
      "PostgreSQL — production-db-primary",
      "CI/CD Deploy Runner #12",
    ],
    affectedUsers: [
      "Database Service Account",
      "2.4M customer records (indirect)",
      "47 admin accounts",
    ],
    complianceImpact:
      "SOC 2 CC6.1 violation — privileged access without approval. PCI-DSS Req 7.1 — access to cardholder data environment credentials requires documented authorization. GDPR Art. 32 — security of processing at risk.",
    recommendedAction:
      "Deny direct secret access. Approve only if paired with JIT credential broker and automatic rotation post-deployment. Require CISO sign-off for break-glass access.",
    confidenceScore: 95,
    submittedAt: "2026-06-28T10:06:05Z",
    slaDeadline: "2026-06-28T14:06:05Z",
    assignee: "Sarah Chen",
    requester: "Deployment Bot (agent-001)",
    timeline: [
      {
        id: "tl-1",
        title: "Log Uploaded",
        description: "agent-actions-2026-06-28.jsonl ingested",
        timestamp: "2026-06-28T10:00:00Z",
        actor: "System",
        type: "created",
      },
      {
        id: "tl-2",
        title: "AI Translation Complete",
        description: "7 entries translated with 96% avg confidence",
        timestamp: "2026-06-28T10:04:00Z",
        actor: "AI Translator",
        type: "analyzed",
      },
      {
        id: "tl-3",
        title: "Risk Classified",
        description: "Critical severity — T1552 Unsecured Credentials",
        timestamp: "2026-06-28T10:06:00Z",
        actor: "Risk Classifier",
        type: "analyzed",
      },
      {
        id: "tl-4",
        title: "Assigned for Review",
        description: "Routed to Security Team — Sarah Chen",
        timestamp: "2026-06-28T10:06:05Z",
        actor: "Approval Engine",
        type: "assigned",
      },
    ],
    history: [
      {
        id: "h-1",
        action: "Approval request created",
        actor: "System",
        timestamp: "2026-06-28T10:06:05Z",
      },
      {
        id: "h-2",
        action: "Auto-assigned to Security Team",
        actor: "Approval Engine",
        timestamp: "2026-06-28T10:06:06Z",
        note: "Critical severity triggers immediate security review",
      },
    ],
  },
  {
    id: "apr-002",
    title: "Unauthorized Admin Permission Grant",
    agentId: "agent-003",
    riskSeverity: "critical",
    priority: "p1",
    aiExplanation:
      "Agent agent-003 attempted to grant admin:write scope to alex.rivera@company.com with approved_by set to null. No human approver exists in the authorization chain, indicating a policy bypass.",
    businessJustification:
      "User requested elevated access via Slack bot integration. Agent interpreted the request as authorization to grant admin scope directly without routing through IT ticketing.",
    affectedSystems: [
      "Identity & Access Management (IAM)",
      "Slack Bot Integration",
      "Enterprise SSO (Okta)",
    ],
    affectedUsers: [
      "alex.rivera@company.com",
      "340 enterprise users (tenant-wide impact)",
    ],
    complianceImpact:
      "ISO 27001 A.9.2.3 — privileged access management failure. SOX 404 — internal control deficiency for financial system access. Company policy SEC-004 requires dual approval for admin grants.",
    recommendedAction:
      "Reject immediately. Revoke any partially applied permissions. Require IT ticket with manager + security approval before re-attempting.",
    confidenceScore: 92,
    submittedAt: "2026-06-28T10:05:38Z",
    slaDeadline: "2026-06-28T14:05:38Z",
    assignee: "Marcus Webb",
    requester: "Slack Bot (agent-003)",
    timeline: [
      {
        id: "tl-5",
        title: "Log Uploaded",
        description: "permission-audit.jsonl ingested",
        timestamp: "2026-06-28T10:03:00Z",
        actor: "System",
        type: "created",
      },
      {
        id: "tl-6",
        title: "Risk Classified",
        description: "Critical — T1098 Account Manipulation",
        timestamp: "2026-06-28T10:05:30Z",
        actor: "Risk Classifier",
        type: "analyzed",
      },
      {
        id: "tl-7",
        title: "Escalation Warning",
        description: "SLA breach in 3h 30m if unresolved",
        timestamp: "2026-06-28T10:05:38Z",
        actor: "Approval Engine",
        type: "escalated",
      },
    ],
    history: [
      {
        id: "h-3",
        action: "Approval request created",
        actor: "System",
        timestamp: "2026-06-28T10:05:38Z",
      },
    ],
  },
  {
    id: "apr-003",
    title: "Bulk Admin User Database Query",
    agentId: "agent-003",
    riskSeverity: "high",
    priority: "p2",
    aiExplanation:
      "Agent executed SELECT * FROM users WHERE role='admin' returning 47 records. Query is not part of any documented runbook and exposes privileged account enumeration data.",
    businessJustification:
      "Security audit automation requested admin account inventory for quarterly access review. Query scope exceeds minimum necessary — should use masked export with audit role.",
    affectedSystems: [
      "PostgreSQL — production-db-primary",
      "Quarterly Access Review System",
    ],
    affectedUsers: ["47 admin accounts"],
    complianceImpact:
      "GDPR Art. 5(1)(c) data minimization — bulk export exceeds necessary scope. PCI-DSS Req 7.1 — need-to-know access principle.",
    recommendedAction:
      "Approve with conditions: restrict to read-only audit role, mask email addresses, and limit export to CSV with 24-hour expiry.",
    confidenceScore: 97,
    submittedAt: "2026-06-28T10:05:00Z",
    slaDeadline: "2026-06-28T18:05:00Z",
    assignee: "Alex Rivera",
    requester: "Audit Bot (agent-003)",
    timeline: [
      {
        id: "tl-8",
        title: "Log Uploaded",
        description: "db-audit-query.log ingested",
        timestamp: "2026-06-28T10:02:00Z",
        actor: "System",
        type: "created",
      },
      {
        id: "tl-9",
        title: "AI Translation Complete",
        description: "Query intent identified as admin enumeration",
        timestamp: "2026-06-28T10:04:30Z",
        actor: "AI Translator",
        type: "analyzed",
      },
      {
        id: "tl-10",
        title: "Assigned for Review",
        description: "Routed to Compliance Team",
        timestamp: "2026-06-28T10:05:00Z",
        actor: "Approval Engine",
        type: "assigned",
      },
    ],
    history: [
      {
        id: "h-4",
        action: "Approval request created",
        actor: "System",
        timestamp: "2026-06-28T10:05:00Z",
      },
    ],
  },
  {
    id: "apr-004",
    title: "Shell Command on Deploy Runner",
    agentId: "agent-002",
    riskSeverity: "medium",
    priority: "p3",
    aiExplanation:
      "Agent agent-002 executed 'git status' on deploy runner #12. Command is benign but agent has unrestricted shell_exec without allowlisting, establishing precedent for arbitrary command execution.",
    businessJustification:
      "Pre-deployment check to verify clean working tree before artifact build. Standard DevOps practice but should use allowlisted commands only.",
    affectedSystems: ["CI/CD Deploy Runner #12", "GitHub Enterprise"],
    affectedUsers: ["Deployment Service Account"],
    complianceImpact:
      "SOC 2 CC8.1 change management — deployment pipeline integrity. DevOps policy DEV-012 requires command allowlisting.",
    recommendedAction:
      "Approve with condition: add git status to agent capability allowlist. Deny if unrestricted shell_exec persists after this action.",
    confidenceScore: 94,
    submittedAt: "2026-06-28T10:02:50Z",
    slaDeadline: "2026-06-29T10:02:50Z",
    assignee: "Sarah Chen",
    requester: "Deploy Bot (agent-002)",
    timeline: [
      {
        id: "tl-11",
        title: "Log Uploaded",
        description: "deploy-events.log ingested",
        timestamp: "2026-06-28T10:01:00Z",
        actor: "System",
        type: "created",
      },
      {
        id: "tl-12",
        title: "Risk Classified",
        description: "Medium — T1059 Command Interpreter",
        timestamp: "2026-06-28T10:02:45Z",
        actor: "Risk Classifier",
        type: "analyzed",
      },
      {
        id: "tl-13",
        title: "Assigned for Review",
        description: "Routed to DevOps Team",
        timestamp: "2026-06-28T10:02:50Z",
        actor: "Approval Engine",
        type: "assigned",
      },
    ],
    history: [
      {
        id: "h-5",
        action: "Approval request created",
        actor: "System",
        timestamp: "2026-06-28T10:02:50Z",
      },
    ],
  },
];

export const PRIORITY_CONFIG = {
  p1: { label: "P1 — Critical", color: "#ff4769", bg: "rgba(255, 71, 105, 0.12)" },
  p2: { label: "P2 — High", color: "#ff8c00", bg: "rgba(255, 140, 0, 0.12)" },
  p3: { label: "P3 — Medium", color: "#ffb900", bg: "rgba(255, 185, 0, 0.12)" },
  p4: { label: "P4 — Low", color: "#00bcf2", bg: "rgba(0, 188, 242, 0.12)" },
} as const;
