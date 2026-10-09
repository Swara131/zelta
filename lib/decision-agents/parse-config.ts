import type {
  DecisionAgentConfig,
  DecisionOutcome,
  DecisionRiskLevel,
  DecisionRule,
  DecisionWorkflowNode,
} from "./types";

function isDecisionOutcome(value: unknown): value is DecisionOutcome {
  return value === "allow" || value === "review" || value === "block";
}

function isDecisionRiskLevel(value: unknown): value is DecisionRiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function parseRule(value: unknown): DecisionRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.label !== "string" ||
    typeof row.expression !== "string" ||
    !isDecisionOutcome(row.outcome)
  ) {
    return null;
  }
  return {
    id: row.id,
    label: row.label,
    expression: row.expression,
    outcome: row.outcome,
    isAiGenerated: row.isAiGenerated === true,
  };
}

function parseWorkflowNode(value: unknown): DecisionWorkflowNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.type !== "string" ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    typeof row.position !== "number"
  ) {
    return null;
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    position: row.position,
  };
}

export function parseDecisionAgentConfig(value: unknown): DecisionAgentConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.decisionQuestion !== "string") return null;
  if (!Array.isArray(row.inputs) || !row.inputs.every((item) => typeof item === "string")) {
    return null;
  }
  if (!Array.isArray(row.actions) || !row.actions.every((item) => typeof item === "string")) {
    return null;
  }
  if (typeof row.approvalWhen !== "string") return null;
  if (typeof row.aiReasoningEnabled !== "boolean") return null;
  if (!Array.isArray(row.rules) || !Array.isArray(row.workflow)) return null;

  const rules: DecisionRule[] = [];
  for (const item of row.rules) {
    const rule = parseRule(item);
    if (!rule) return null;
    rules.push(rule);
  }

  const workflow: DecisionWorkflowNode[] = [];
  for (const item of row.workflow) {
    const node = parseWorkflowNode(item);
    if (!node) return null;
    workflow.push(node);
  }

  const config: DecisionAgentConfig = {
    decisionQuestion: row.decisionQuestion,
    inputs: row.inputs,
    rules,
    actions: row.actions,
    approvalWhen: row.approvalWhen,
    workflow,
    aiReasoningEnabled: row.aiReasoningEnabled,
  };

  if (isDecisionRiskLevel(row.riskLevel)) config.riskLevel = row.riskLevel;
  if (typeof row.approvalLevel === "string") config.approvalLevel = row.approvalLevel;
  if (
    Array.isArray(row.possibleOutcomes) &&
    row.possibleOutcomes.every(isDecisionOutcome)
  ) {
    config.possibleOutcomes = row.possibleOutcomes;
  }
  if (typeof row.generatedAt === "string") config.generatedAt = row.generatedAt;

  return config;
}

export function emptyDecisionAgentConfig(): DecisionAgentConfig {
  return {
    decisionQuestion: "",
    inputs: [],
    rules: [],
    actions: [],
    approvalWhen: "",
    workflow: [],
    aiReasoningEnabled: false,
  };
}

export function parseDecisionAgentConfigOrDefault(value: unknown): DecisionAgentConfig {
  return parseDecisionAgentConfig(value) ?? emptyDecisionAgentConfig();
}
