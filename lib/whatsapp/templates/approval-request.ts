import { humanizeAgentLabel } from "@/lib/dashboard/founder-copy";
import { describeActionIntent } from "@/lib/approvals/action-review-copy";
import type { RiskSeverity } from "@/lib/risk-types";
import type { PendingApproval } from "@/lib/approval-types";
import { riskScoreBandFromNormalized } from "@/lib/approvals/risk-score-breakdown";

export interface WhatsAppApprovalMessageInput {
  agentId: string;
  toolName: string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  riskLevel: RiskSeverity;
  riskScore: number;
  approveUrl: string;
  rejectUrl: string;
  reviewUrl: string;
}

function normalizeScore(score: number): number {
  if (score > 1) return Math.min(score / 100, 1);
  return Math.max(0, Math.min(score, 1));
}

function extractCustomer(payload: Record<string, unknown>): string | null {
  for (const key of ["customerName", "customer_name", "name", "customerId", "customer_id"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildActionQuestion(input: WhatsAppApprovalMessageInput): string {
  const approval = {
    agentId: input.agentId,
    toolName: input.toolName,
    actionType: input.actionType,
    actionPayload: input.actionPayload ?? {},
  } as PendingApproval;

  let intent = describeActionIntent(approval);
  intent = intent.replace(/^Issue an?\s+/i, "Issue ");
  return intent.endsWith("?") ? intent : `${intent}?`;
}

export function renderWhatsAppApprovalRequest(input: WhatsAppApprovalMessageInput): {
  body: string;
  preview: string;
} {
  const agentName = humanizeAgentLabel(input.agentId);
  const normalized = normalizeScore(input.riskScore);
  const band = riskScoreBandFromNormalized(normalized);
  const customer = extractCustomer(input.actionPayload ?? {});
  const actionQuestion = buildActionQuestion(input);

  const lines = [
    `🔔 ${agentName} needs your approval`,
    "",
    actionQuestion,
  ];

  if (customer) {
    lines.push(`Customer: ${customer}`);
  }

  lines.push(`Risk: ${band} (${normalized.toFixed(2)})`);
  lines.push("");
  lines.push(`Approve: ${input.approveUrl}`);
  lines.push(`Reject: ${input.rejectUrl}`);
  lines.push("");
  lines.push(`Review on Wave: ${input.reviewUrl}`);
  lines.push("Tap to approve on Wave dashboard");

  const body = lines.join("\n");
  const preview = `${agentName} · ${actionQuestion.replace("?", "")} · Risk ${band}`;

  return { body, preview };
}
