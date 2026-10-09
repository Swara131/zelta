import { evaluatePolicy } from "@/lib/gateway/policy/engine";
import { buildPolicyEvaluationContext } from "@/lib/gateway/policy/context";
import {
  buildRiskContext,
  extractDeterministicRiskSignals,
} from "@/lib/gateway/risk/signals";
import type { RiskSeverity } from "@/lib/risk-types";
import { loadAgentProtectionSettings } from "@/lib/agent-builder/agent-protection-settings";

export type AgentTestToolId =
  | "send_email"
  | "send_whatsapp"
  | "issue_refund"
  | "update_crm"
  | "query_db"
  | "create_calendar";

export interface AgentTestToolOption {
  id: AgentTestToolId;
  label: string;
  toolName: string;
  actionType: string;
  defaultPayload: Record<string, unknown>;
}

export const AGENT_TEST_TOOLS: AgentTestToolOption[] = [
  {
    id: "send_email",
    label: "send_email",
    toolName: "send_email",
    actionType: "communication.email",
    defaultPayload: {
      customerId: "cus_123",
      subject: "Refund confirmed",
      message: "Your refund is confirmed",
    },
  },
  {
    id: "send_whatsapp",
    label: "send_whatsapp",
    toolName: "send_whatsapp_message",
    actionType: "communication.whatsapp",
    defaultPayload: {
      customerId: "cus_123",
      message: "Your refund is confirmed",
    },
  },
  {
    id: "issue_refund",
    label: "issue_refund",
    toolName: "issue_refund",
    actionType: "financial.refund",
    defaultPayload: {
      customerId: "cus_123",
      amount: 5000,
      currency: "INR",
      message: "Your refund is confirmed",
    },
  },
  {
    id: "update_crm",
    label: "update_crm",
    toolName: "update_crm_record",
    actionType: "crm.update",
    defaultPayload: {
      customerId: "cus_123",
      field: "status",
      value: "refund_pending",
    },
  },
  {
    id: "query_db",
    label: "query_db",
    toolName: "query_database",
    actionType: "data.query",
    defaultPayload: {
      customerId: "cus_123",
      query: "SELECT status FROM customers WHERE id = $1",
    },
  },
  {
    id: "create_calendar",
    label: "create_calendar",
    toolName: "create_calendar_event",
    actionType: "calendar.create",
    defaultPayload: {
      customerId: "cus_123",
      title: "Follow-up call",
      startsAt: "2026-09-06T10:00:00Z",
    },
  },
];

export function getAgentTestTool(id: AgentTestToolId): AgentTestToolOption {
  const tool = AGENT_TEST_TOOLS.find((item) => item.id === id);
  if (!tool) throw new Error("Unknown tool.");
  return tool;
}

export type AgentTestDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface AgentTestEvaluation {
  decision: AgentTestDecision;
  riskScore: number;
  riskScoreDisplay: number;
  riskLevel: RiskSeverity;
  riskLevelLabel: string;
  reason: string;
  statusLabel: string;
  thresholdInr: number;
  policySummary: string;
  decisionSummary: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
}

function normalizePayload(
  tool: AgentTestToolOption,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...payload };

  if (tool.id === "issue_refund" && typeof next.amount === "number") {
    const amount = next.amount;
    if (amount > 0 && amount < 100_000) {
      next.amount = Math.round(amount * 100);
      next.currency = next.currency ?? "INR";
    }
  }

  if (tool.id === "query_db") {
    next.environment = next.environment ?? "test";
    next.resourceType = next.resourceType ?? "database";
    next.destructiveOperation = next.destructiveOperation ?? false;
    next.productionTarget = next.productionTarget ?? false;
  }

  return next;
}

function deriveRiskLevel(
  decision: AgentTestDecision,
  signals: ReturnType<typeof extractDeterministicRiskSignals>
): RiskSeverity {
  if (decision === "BLOCK") return "critical";

  const rank = { high: 3, medium: 2, low: 1 } as const;
  let max: keyof typeof rank = "low";
  for (const signal of signals) {
    if (rank[signal.severity] > rank[max]) max = signal.severity;
  }
  if (decision === "REVIEW" && max === "low") return "medium";
  return max;
}

function deriveRiskScore(
  signals: ReturnType<typeof extractDeterministicRiskSignals>,
  decision: AgentTestDecision
): number {
  const weights = { high: 78, medium: 52, low: 24 };
  let score = 20;
  for (const signal of signals) {
    score = Math.max(score, weights[signal.severity]);
  }
  if (decision === "REVIEW") score = Math.max(score, 65);
  if (decision === "BLOCK") score = Math.max(score, 92);
  return Math.min(score, 100);
}

function riskLevelLabel(level: RiskSeverity): string {
  switch (level) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    case "critical":
      return "CRITICAL";
  }
}

function buildReason(
  decision: AgentTestDecision,
  matched: { reason: string; policyId?: string }[],
  thresholdInr: number,
  amountInr: number | null
): string {
  const primary = matched[0];
  if (decision === "ALLOW") {
    if (amountInr != null && amountInr <= thresholdInr) {
      return `Under ₹${thresholdInr.toLocaleString("en-IN")} threshold`;
    }
    return primary?.reason ?? "Action matches an automatic allow rule.";
  }
  if (decision === "REVIEW") {
    if (amountInr != null && amountInr > thresholdInr) {
      return `Exceeds ₹${thresholdInr.toLocaleString("en-IN")} auto-approve threshold`;
    }
    return primary?.reason ?? "This action requires human approval.";
  }
  return primary?.reason ?? "This action violates your policy.";
}

function decisionSummary(decision: AgentTestDecision): string {
  switch (decision) {
    case "ALLOW":
      return "✓ ALLOW (auto-approved)";
    case "REVIEW":
      return "⚠ APPROVAL REQUIRED";
    case "BLOCK":
      return "✕ BLOCK";
  }
}

function statusLabel(decision: AgentTestDecision): string {
  switch (decision) {
    case "ALLOW":
      return "Ready to execute";
    case "REVIEW":
      return "Waiting for approval";
    case "BLOCK":
      return "Blocked by policy";
  }
}

export function evaluateAgentTestAction(params: {
  agentId: string;
  toolId: AgentTestToolId;
  payload: Record<string, unknown>;
}): AgentTestEvaluation {
  const tool = getAgentTestTool(params.toolId);
  const payload = normalizePayload(tool, params.payload);
  const settings = loadAgentProtectionSettings(params.agentId);
  const thresholdInr = settings.thresholdInr;

  const evaluation = evaluatePolicy({
    toolName: tool.toolName,
    actionType: tool.actionType,
    payload,
  });

  const decision = evaluation.decision as AgentTestDecision;
  const riskContext = buildRiskContext({
    agentId: params.agentId,
    toolName: tool.toolName,
    actionType: tool.actionType,
    payload,
  });
  const riskSignals = extractDeterministicRiskSignals(riskContext);
  const riskLevel = deriveRiskLevel(decision, riskSignals);
  const riskScore = deriveRiskScore(riskSignals, decision);
  const riskScoreDisplay = Math.round(((100 - riskScore) / 100) * 100) / 100;

  const ctx = buildPolicyEvaluationContext({
    toolName: tool.toolName,
    actionType: tool.actionType,
    payload,
  });
  const amountInr =
    ctx.amount != null ? Math.round(ctx.amount / 100) : null;

  const reason = buildReason(
    decision,
    evaluation.matchedPolicies,
    thresholdInr,
    amountInr
  );

  return {
    decision,
    riskScore,
    riskScoreDisplay,
    riskLevel,
    riskLevelLabel: riskLevelLabel(riskLevel),
    reason,
    statusLabel: statusLabel(decision),
    thresholdInr,
    policySummary: `Policy checked (threshold: ₹${thresholdInr.toLocaleString("en-IN")})`,
    decisionSummary: decisionSummary(decision),
    toolName: tool.toolName,
    actionType: tool.actionType,
    payload,
  };
}

export function defaultPayloadJson(toolId: AgentTestToolId): string {
  return JSON.stringify(getAgentTestTool(toolId).defaultPayload, null, 2);
}
