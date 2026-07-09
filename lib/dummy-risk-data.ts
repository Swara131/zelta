import type { RiskAnalysisSummary } from "./risk-types";

export const DUMMY_RISK_ANALYSIS: RiskAnalysisSummary = {
  overallScore: 73,
  riskLevel: "high",
  totalDetected: 6,
  analyzedLogs: 7,
  lastUpdated: "2026-06-28T10:08:00Z",
  distribution: [
    { severity: "critical", count: 2, label: "Critical" },
    { severity: "high", count: 2, label: "High" },
    { severity: "medium", count: 1, label: "Medium" },
    { severity: "low", count: 1, label: "Low" },
  ],
  trend: [
    { date: "Jun 22", score: 28, critical: 0, high: 1, medium: 2, low: 3 },
    { date: "Jun 23", score: 35, critical: 0, high: 1, medium: 3, low: 4 },
    { date: "Jun 24", score: 42, critical: 1, high: 1, medium: 2, low: 3 },
    { date: "Jun 25", score: 51, critical: 1, high: 2, medium: 3, low: 4 },
    { date: "Jun 26", score: 58, critical: 1, high: 2, medium: 4, low: 5 },
    { date: "Jun 27", score: 65, critical: 2, high: 2, medium: 3, low: 4 },
    { date: "Jun 28", score: 73, critical: 2, high: 2, medium: 1, low: 1 },
  ],
  risks: [
    {
      id: "risk-001",
      title: "Unauthorized Production Secrets Access",
      severity: "critical",
      explanation:
        "AI agent agent-001 retrieved production database credentials from AWS Secrets Manager without an associated change ticket or approval record. This exposes credentials that grant full read/write access to the production PostgreSQL cluster.",
      businessImpact:
        "Potential data breach affecting 2.4M customer records. Estimated financial exposure: $1.2M–$4.8M per incident (IBM Cost of Data Breach 2025). Service disruption risk if credentials are rotated unexpectedly.",
      complianceImpact:
        "Violates SOC 2 CC6.1 (logical access controls), PCI-DSS Req 7 & 8 (restrict access to cardholder data), and GDPR Art. 32 (security of processing). Requires incident notification within 72 hours if credentials were exfiltrated.",
      mitreAttack: {
        tactic: "Credential Access",
        technique: "Unsecured Credentials",
        techniqueId: "T1552",
      },
      owaspCategory: "A07:2021 – Identification and Authentication Failures",
      suggestedAction:
        "Immediately rotate prod/db/credentials, revoke agent-001's Secrets Manager IAM policy, and require break-glass approval workflow for all secret access going forward.",
      confidence: 95,
      aiRecommendation:
        "Treat as P1 incident. Enable AWS CloudTrail alerting on GetSecretValue for production secret ARNs. Implement just-in-time (JIT) access via AWS IAM Identity Center with 15-minute session limits.",
      relatedEvents: [
        {
          id: "ev-001",
          title: "GetSecretValue — prod/db/credentials",
          timestamp: "2026-06-28T10:06:01Z",
          severity: "critical",
        },
        {
          id: "ev-002",
          title: "Database Query — SELECT * FROM users WHERE role='admin'",
          timestamp: "2026-06-28T10:04:56Z",
          severity: "high",
        },
      ],
      detectedAt: "2026-06-28T10:06:05Z",
      sourceLog: "agent-003 → secrets-manager.aws.internal/GetSecretValue",
    },
    {
      id: "risk-002",
      title: "Unapproved Privilege Escalation",
      severity: "critical",
      explanation:
        "Agent agent-003 attempted to grant admin:write scope to user alex.rivera@company.com without an approved authorization record. The permission_grant action had approved_by set to null, indicating no human approver in the chain.",
      businessImpact:
        "Unauthorized admin access could lead to full tenant compromise, data modification, or lateral movement across all connected SaaS integrations. Affects IAM for 340 enterprise users.",
      complianceImpact:
        "Breaches ISO 27001 A.9.2.3 (management of privileged access rights) and SOX Section 404 (internal controls over financial reporting systems). Privileged access changes require documented approval per company policy SEC-004.",
      mitreAttack: {
        tactic: "Privilege Escalation",
        technique: "Account Manipulation",
        techniqueId: "T1098",
      },
      owaspCategory: "A01:2021 – Broken Access Control",
      suggestedAction:
        "Revoke the granted permission immediately, audit all permission changes in the last 30 days, and enforce mandatory approval workflow for any scope containing 'admin'.",
      confidence: 92,
      aiRecommendation:
        "Deploy attribute-based access control (ABAC) policy requiring dual approval for admin scope grants. Add real-time alerting on permission_grant events where approved_by is null.",
      relatedEvents: [
        {
          id: "ev-003",
          title: "permission_grant — admin:write → alex.rivera",
          timestamp: "2026-06-28T10:05:33Z",
          severity: "critical",
        },
      ],
      detectedAt: "2026-06-28T10:05:38Z",
      sourceLog: "agent-003 → permission_grant user:alex.rivera",
    },
    {
      id: "risk-003",
      title: "Sensitive System File Access",
      severity: "high",
      explanation:
        "Agent agent-001 read /etc/passwd on production node prod-web-03 running as root (UID 0). While /etc/passwd is world-readable on Linux, access from an AI agent context combined with subsequent credential access suggests reconnaissance behavior.",
      businessImpact:
        "Indicates potential host reconnaissance preceding credential theft. If combined with kernel exploits or misconfigurations, could enable container escape or host persistence.",
      complianceImpact:
        "May trigger HIPAA Security Rule §164.312(a)(1) access control review if prod-web-03 processes PHI-adjacent metadata. Requires entry in quarterly access review log.",
      mitreAttack: {
        tactic: "Discovery",
        technique: "System Information Discovery",
        techniqueId: "T1082",
      },
      owaspCategory: "A05:2021 – Security Misconfiguration",
      suggestedAction:
        "Restrict agent file_read operations to an explicit allowlist. Run osquery scan on prod-web-03 for unauthorized process activity in the last 24 hours.",
      confidence: 96,
      aiRecommendation:
        "Correlate with the Secrets Manager access event (risk-001) — combined pattern matches MITRE ATT&CK chain: Discovery → Credential Access. Escalate to SOC Tier 2.",
      relatedEvents: [
        {
          id: "ev-004",
          title: "file_read — /etc/passwd (UID 0)",
          timestamp: "2026-06-28T10:00:00Z",
          severity: "high",
        },
      ],
      detectedAt: "2026-06-28T10:00:08Z",
      sourceLog: "agent-001 → file_read /etc/passwd",
    },
    {
      id: "risk-004",
      title: "Bulk Admin User Enumeration",
      severity: "high",
      explanation:
        "Agent agent-003 executed a SQL query returning all 47 admin-role users from the production database. This bulk enumeration of privileged accounts is not part of any documented operational runbook.",
      businessImpact:
        "Admin account list enables targeted credential attacks, phishing campaigns against privileged users, and identification of high-value targets for lateral movement.",
      complianceImpact:
        "GDPR Art. 5(1)(f) integrity and confidentiality principle — bulk access to identity data requires legitimate interest assessment. PCI-DSS Req 7.1 limits access to need-to-know basis.",
      mitreAttack: {
        tactic: "Discovery",
        technique: "Account Discovery",
        techniqueId: "T1087",
      },
      owaspCategory: "A01:2021 – Broken Access Control",
      suggestedAction:
        "Review database query logging for agent-003. Implement row-level security (RLS) preventing bulk admin enumeration without security team role.",
      confidence: 97,
      aiRecommendation:
        "Cross-reference enumerated accounts against recent MFA enrollment status. Prioritize MFA enforcement for all 47 admin accounts within 48 hours.",
      relatedEvents: [
        {
          id: "ev-005",
          title: "database_query — SELECT * FROM users WHERE role='admin'",
          timestamp: "2026-06-28T10:04:56Z",
          severity: "high",
        },
      ],
      detectedAt: "2026-06-28T10:05:00Z",
      sourceLog: "agent-003 → production-db-primary",
    },
    {
      id: "risk-005",
      title: "Unrestricted Shell Command Execution",
      severity: "medium",
      explanation:
        "Agent agent-002 executed 'git status' in the deployment directory. While low-risk in isolation, the agent has unrestricted shell_exec capability without command allowlisting, creating precedent for arbitrary command execution.",
      businessImpact:
        "Unrestricted shell access on deploy runners could enable supply chain attacks, malicious code injection into CI/CD pipelines, or deployment of compromised artifacts to production.",
      complianceImpact:
        "SOC 2 CC8.1 change management — deployment pipeline commands should be restricted to approved scripts. DevOps policy DEV-012 requires command allowlisting on all CI runners.",
      mitreAttack: {
        tactic: "Execution",
        technique: "Command and Scripting Interpreter",
        techniqueId: "T1059",
      },
      owaspCategory: "A08:2021 – Software and Data Integrity Failures",
      suggestedAction:
        "Implement command allowlist on deploy runners. Restrict shell_exec to pre-approved commands defined in agent capability manifest.",
      confidence: 94,
      aiRecommendation:
        "Low immediate risk but high latent risk. Add shell_exec to agent capability audit dashboard and review all commands executed in the past 7 days.",
      relatedEvents: [
        {
          id: "ev-006",
          title: "shell_exec — git status",
          timestamp: "2026-06-28T10:02:45Z",
          severity: "medium",
        },
      ],
      detectedAt: "2026-06-28T10:02:50Z",
      sourceLog: "agent-002 → shell_exec git status",
    },
    {
      id: "risk-006",
      title: "External API Data Retrieval",
      severity: "low",
      explanation:
        "Agent agent-001 made a successful GET request to api.example.com/v2/users returning user records. The request completed with HTTP 200 and is within the agent's documented API access scope.",
      businessImpact:
        "Minimal direct impact. User data accessed is within authorized integration scope. Monitor for unusual volume spikes that could indicate data exfiltration.",
      complianceImpact:
        "GDPR lawful basis confirmed via Data Processing Agreement with api.example.com. No compliance action required unless access volume exceeds baseline by 3σ.",
      mitreAttack: {
        tactic: "Collection",
        technique: "Data from Information Repositories",
        techniqueId: "T1213",
      },
      owaspCategory: "A02:2021 – Cryptographic Failures",
      suggestedAction:
        "No immediate action required. Add baseline monitoring for API call volume from agent-001 to detect anomalous data retrieval patterns.",
      confidence: 99,
      aiRecommendation:
        "Informational finding. Include in weekly agent activity report. Consider adding response size limits to prevent bulk data export via pagination abuse.",
      relatedEvents: [
        {
          id: "ev-007",
          title: "network_request — GET api.example.com/v2/users",
          timestamp: "2026-06-28T10:01:23Z",
          severity: "low",
        },
      ],
      detectedAt: "2026-06-28T10:01:30Z",
      sourceLog: "agent-001 → api.example.com/v2/users",
    },
  ],
};

export {
  SEVERITY_COLORS,
  getRiskLevelLabel,
  getRiskLevelSeverity,
} from "./risk/severity";
