import type { SafetyIncidentRecord } from "./types";

export function buildSampleIncidents(
  agentId: string,
  organizationId: string
): SafetyIncidentRecord[] {
  const now = Date.now();
  return [
    {
      id: `sample-${agentId}-1`,
      agentId,
      organizationId,
      severity: "info",
      title: "Approval requested for email draft",
      explanation:
        "The agent prepared an outreach email and waited for your approval before sending.",
      relatedTool: "Gmail",
      runId: null,
      actionTaken: "Held for approval",
      isSample: true,
      createdAt: new Date(now - 3600_000).toISOString(),
    },
    {
      id: `sample-${agentId}-2`,
      agentId,
      organizationId,
      severity: "warning",
      title: "Large recipient list flagged",
      explanation:
        "A send attempt exceeded your recipient threshold. Wave paused the action until reviewed.",
      relatedTool: "Gmail",
      runId: null,
      actionTaken: "Blocked pending approval",
      isSample: true,
      createdAt: new Date(now - 7200_000).toISOString(),
    },
    {
      id: `sample-${agentId}-3`,
      agentId,
      organizationId,
      severity: "blocked",
      title: "Untrusted content sanitized",
      explanation:
        "Content from an external web page was treated as untrusted. Potential instruction override patterns were removed.",
      relatedTool: "Browser",
      runId: null,
      actionTaken: "Sanitized input",
      isSample: true,
      createdAt: new Date(now - 86400_000).toISOString(),
    },
  ];
}
