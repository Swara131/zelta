import type { TranslatedAction } from "./translator-types";

export const SAMPLE_TECHNICAL_LOG = `{"timestamp":"2026-06-28T10:00:00.000Z","agent_id":"agent-001","action":"file_read","target":"/etc/passwd","risk_level":"high","session_id":"sess_a8f3b2c1","metadata":{"pid":44821,"uid":0}}
{"timestamp":"2026-06-28T10:01:23.441Z","agent_id":"agent-001","action":"network_request","target":"api.example.com/v2/users","method":"GET","risk_level":"low","session_id":"sess_a8f3b2c1","status_code":200}
{"timestamp":"2026-06-28T10:02:45.112Z","agent_id":"agent-002","action":"shell_exec","target":"git status","risk_level":"medium","session_id":"sess_d4e5f6a7","cwd":"/var/app/deploy"}
{"timestamp":"2026-06-28T10:03:12.887Z","agent_id":"agent-002","action":"file_write","target":"./output/deployment.log","risk_level":"low","session_id":"sess_d4e5f6a7","bytes_written":2048}
{"timestamp":"2026-06-28T10:04:56.003Z","agent_id":"agent-003","action":"database_query","target":"SELECT * FROM users WHERE role='admin'","risk_level":"high","session_id":"sess_b9c0d1e2","rows_returned":47}
{"timestamp":"2026-06-28T10:05:33.219Z","agent_id":"agent-003","action":"permission_grant","target":"user:alex.rivera","scope":"admin:write","risk_level":"critical","session_id":"sess_b9c0d1e2","approved_by":null}
{"timestamp":"2026-06-28T10:06:01.554Z","agent_id":"agent-001","action":"api_call","target":"secrets-manager.aws.internal/GetSecretValue","risk_level":"high","session_id":"sess_a8f3b2c1","secret_id":"prod/db/credentials"}`;

export const DUMMY_TRANSLATIONS: TranslatedAction[] = [
  {
    id: "t1",
    lineNumber: 1,
    action: "Sensitive File Read",
    explanation:
      "The AI agent attempted to read the system password file (/etc/passwd), which contains user account information. This is a privileged operation typically restricted on production systems.",
    affectedSystem: "Linux Host — Production Node prod-web-03",
    affectedUser: "root (UID 0)",
    timestamp: "2026-06-28T10:00:00.000Z",
    businessImpact: "high",
    aiConfidence: 96,
  },
  {
    id: "t2",
    lineNumber: 2,
    action: "External API Request",
    explanation:
      "The agent made an outbound HTTP GET request to retrieve user records from an external API endpoint. The request completed successfully with a 200 status code.",
    affectedSystem: "User Management API — api.example.com",
    affectedUser: "All registered users (data accessed)",
    timestamp: "2026-06-28T10:01:23.441Z",
    businessImpact: "low",
    aiConfidence: 99,
  },
  {
    id: "t3",
    lineNumber: 3,
    action: "Shell Command Execution",
    explanation:
      "The agent executed a git status command in the deployment directory to inspect the current state of the repository before proceeding with deployment tasks.",
    affectedSystem: "CI/CD Pipeline — Deploy Runner #12",
    affectedUser: "Deployment Service Account",
    timestamp: "2026-06-28T10:02:45.112Z",
    businessImpact: "medium",
    aiConfidence: 94,
  },
  {
    id: "t4",
    lineNumber: 4,
    action: "Log File Write",
    explanation:
      "The agent wrote 2 KB of deployment output to a local log file. This is standard operational logging with no external data exposure.",
    affectedSystem: "Application Server — /var/app/deploy",
    affectedUser: "N/A (system operation)",
    timestamp: "2026-06-28T10:03:12.887Z",
    businessImpact: "none",
    aiConfidence: 98,
  },
  {
    id: "t5",
    lineNumber: 5,
    action: "Database Query — Admin Users",
    explanation:
      "The agent ran a SQL query returning all users with admin role privileges. This exposes sensitive account data and should require explicit approval before execution.",
    affectedSystem: "PostgreSQL — production-db-primary",
    affectedUser: "47 admin accounts",
    timestamp: "2026-06-28T10:04:56.003Z",
    businessImpact: "high",
    aiConfidence: 97,
  },
  {
    id: "t6",
    lineNumber: 6,
    action: "Unauthorized Permission Grant",
    explanation:
      "The agent attempted to grant admin write permissions to a user without an approved authorization record. This action was flagged as critical and requires immediate review.",
    affectedSystem: "Identity & Access Management (IAM)",
    affectedUser: "alex.rivera@company.com",
    timestamp: "2026-06-28T10:05:33.219Z",
    businessImpact: "critical",
    aiConfidence: 92,
  },
  {
    id: "t7",
    lineNumber: 7,
    action: "Secrets Manager Access",
    explanation:
      "The agent requested production database credentials from AWS Secrets Manager. Accessing production secrets is a high-risk operation that must be tied to an approved change request.",
    affectedSystem: "AWS Secrets Manager — prod/db/credentials",
    affectedUser: "Database Service (indirect — all DB consumers)",
    timestamp: "2026-06-28T10:06:01.554Z",
    businessImpact: "critical",
    aiConfidence: 95,
  },
];

export function formatTranslationsForCopy(translations: TranslatedAction[]): string {
  return translations
    .map(
      (t, i) =>
        `--- Action ${i + 1}: ${t.action} ---
Explanation: ${t.explanation}
Affected System: ${t.affectedSystem}
Affected User: ${t.affectedUser}
Timestamp: ${t.timestamp}
Business Impact: ${t.businessImpact.toUpperCase()}
AI Confidence: ${t.aiConfidence}%`
    )
    .join("\n\n");
}

export function formatTranslationsForDownload(translations: TranslatedAction[]): string {
  return JSON.stringify(translations, null, 2);
}
