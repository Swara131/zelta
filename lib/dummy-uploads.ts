import type { UploadRecord } from "./types";

export const INITIAL_UPLOADS: UploadRecord[] = [
  {
    id: "1",
    filename: "agent-actions-2026-06-28.csv",
    uploadedBy: "Sarah Chen",
    date: "2026-06-28T14:32:00Z",
    status: "completed",
    riskScore: 12,
  },
  {
    id: "2",
    filename: "api-gateway-logs.json",
    uploadedBy: "Marcus Webb",
    date: "2026-06-27T09:15:00Z",
    status: "completed",
    riskScore: 34,
  },
  {
    id: "3",
    filename: "deployment-events.log",
    uploadedBy: "Sarah Chen",
    date: "2026-06-26T16:48:00Z",
    status: "failed",
    riskScore: 78,
  },
  {
    id: "4",
    filename: "user-permissions-audit.txt",
    uploadedBy: "Alex Rivera",
    date: "2026-06-25T11:02:00Z",
    status: "processing",
    riskScore: 45,
  },
  {
    id: "5",
    filename: "security-scan-results.csv",
    uploadedBy: "Marcus Webb",
    date: "2026-06-24T08:30:00Z",
    status: "pending",
    riskScore: 91,
  },
];

export const SAMPLE_FILE_CONTENT = `timestamp,agent_id,action,target,risk_level
2026-06-28T10:00:00Z,agent-001,file_read,/etc/passwd,high
2026-06-28T10:01:23Z,agent-001,network_request,api.example.com,low
2026-06-28T10:02:45Z,agent-002,shell_exec,git status,medium
2026-06-28T10:03:12Z,agent-002,file_write,./output.log,low
2026-06-28T10:04:56Z,agent-003,database_query,SELECT * FROM users,high
`;

export const SAMPLE_FILENAME = "sample-agent-logs.csv";
