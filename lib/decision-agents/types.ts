export type DecisionAgentStatus =
  | "draft"
  | "testing"
  | "verified"
  | "deployed"
  | "paused"
  | "needs_attention";

export type DecisionOutcome = "allow" | "review" | "block";

export interface DecisionRule {
  id: string;
  label: string;
  expression: string;
  outcome: DecisionOutcome;
  isAiGenerated?: boolean;
}

export interface DecisionWorkflowNode {
  id: string;
  type: string;
  name: string;
  description: string;
  position: number;
}

export type DecisionRiskLevel = "low" | "medium" | "high";

export interface DecisionAgentConfig {
  decisionQuestion: string;
  inputs: string[];
  rules: DecisionRule[];
  actions: string[];
  approvalWhen: string;
  workflow: DecisionWorkflowNode[];
  aiReasoningEnabled: boolean;
  riskLevel?: DecisionRiskLevel;
  approvalLevel?: string;
  possibleOutcomes?: DecisionOutcome[];
  generatedAt?: string;
}

/** Preview returned from generate — not persisted until Save. */
export interface GeneratedDecisionAgentPreview {
  name: string;
  purpose: string;
  decisionType: string;
  config: DecisionAgentConfig;
  riskLevel: DecisionRiskLevel;
  approvalLevel: string;
  possibleOutcomes: DecisionOutcome[];
  status: DecisionAgentStatus;
  createdAt: string;
}

export interface DecisionAgentRecord {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  slug: string;
  purpose: string;
  decisionType: string;
  status: DecisionAgentStatus;
  config: DecisionAgentConfig;
  safetySettings: Record<string, unknown>;
  deployment: {
    version: number;
    state: string;
    deployedAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DecisionTestCaseRecord {
  id: string;
  decisionAgentId: string;
  input: Record<string, unknown>;
  expectedDecision: string;
  actualDecision?: string | null;
  status: "not_run" | "pass" | "fail" | "needs_attention";
  lastRunAt?: string | null;
}

export const DECISION_AGENT_TEMPLATES = [
  {
    id: "refund",
    name: "Refund Decision Agent",
    purpose: "Evaluate whether a customer refund should be automatically approved.",
    decisionType: "refund",
  },
  {
    id: "lead",
    name: "Lead Qualification Agent",
    purpose: "Qualify inbound leads based on fit and intent signals.",
    decisionType: "lead_qualification",
  },
  {
    id: "fraud",
    name: "Fraud Review Agent",
    purpose: "Review suspicious transactions and route high-risk cases for review.",
    decisionType: "fraud_review",
  },
  {
    id: "support",
    name: "Support Escalation Agent",
    purpose: "Decide when a support ticket should be escalated to a human.",
    decisionType: "support_escalation",
  },
  {
    id: "expense",
    name: "Expense Approval Agent",
    purpose: "Approve or review employee expense requests.",
    decisionType: "expense_approval",
  },
] as const;
