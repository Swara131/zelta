import type {
  DecisionAgentConfig,
  DecisionOutcome,
  DecisionRiskLevel,
  DecisionWorkflowNode,
  GeneratedDecisionAgentPreview,
} from "./types";

function defaultWorkflow(name: string): DecisionWorkflowNode[] {
  return [
    { id: "request", type: "input", name: "Request", description: "Incoming decision request", position: 0 },
    { id: "collect", type: "data", name: "Collect Information", description: "Gather required inputs", position: 1 },
    { id: "ai", type: "ai", name: "AI Analysis", description: "Analyze context with AI reasoning", position: 2 },
    { id: "policy", type: "policy", name: "Policy Check", description: "Evaluate deterministic rules", position: 3 },
    { id: "risk", type: "risk", name: "Risk Assessment", description: "Score risk through Wave Safety", position: 4 },
    { id: "decision", type: "decision", name: "Decision", description: name, position: 5 },
    { id: "action", type: "action", name: "Action", description: "Execute allowed outcome", position: 6 },
  ];
}

function inferInputs(prompt: string): string[] {
  const inputs = new Set<string>();
  if (/refund|amount|₹|\$/i.test(prompt)) inputs.add("refund_amount");
  if (/customer|eligible|user|history/i.test(prompt)) inputs.add("customer_eligible");
  if (/order|days|age/i.test(prompt)) inputs.add("order_age");
  if (/risk|fraud|suspicious/i.test(prompt)) inputs.add("risk_score");
  if (/lead|company|intent/i.test(prompt)) inputs.add("lead_signals");
  if (/expense|receipt|employee/i.test(prompt)) inputs.add("expense_details");
  if (inputs.size === 0) inputs.add("request_context");
  return [...inputs];
}

function inferApprovalWhen(prompt: string): string {
  if (/human|approval|review|manager/i.test(prompt)) {
    return "When policy rules do not match or risk is high.";
  }
  return "When the decision outcome is REVIEW or risk exceeds threshold.";
}

function inferRiskLevel(prompt: string, inputs: string[]): DecisionRiskLevel {
  if (/fraud|block|high.?risk|suspicious/i.test(prompt)) return "high";
  if (/refund|expense|approval|review/i.test(prompt)) return "medium";
  if (inputs.includes("risk_score")) return "medium";
  return "low";
}

function inferApprovalLevel(prompt: string, rules: DecisionAgentConfig["rules"]): string {
  if (/manager|executive|human/i.test(prompt)) return "Manager approval required";
  if (rules.some((rule) => rule.outcome === "review")) return "Human review when REVIEW outcome";
  return "Automatic for ALLOW; review for edge cases";
}

export function generateDecisionAgentFromPrompt(params: {
  prompt: string;
  name?: string;
  decisionType?: string;
}): GeneratedDecisionAgentPreview {
  const purpose = params.prompt.trim();
  const name =
    params.name?.trim() ||
    (purpose.length > 48 ? `${purpose.slice(0, 45)}… Agent` : `${purpose} Agent`);

  const inputs = inferInputs(purpose);
  const rules: DecisionAgentConfig["rules"] = [];

  if (inputs.includes("refund_amount")) {
    rules.push({
      id: "rule-refund-auto",
      label: "Auto-approve small refunds",
      expression: "refund_amount <= threshold AND customer_eligible = true AND risk_score < threshold",
      outcome: "allow" as DecisionOutcome,
      isAiGenerated: true,
    });
    rules.push({
      id: "rule-refund-review",
      label: "Review large or risky refunds",
      expression: "otherwise",
      outcome: "review" as DecisionOutcome,
      isAiGenerated: true,
    });
  } else {
    rules.push({
      id: "rule-default-review",
      label: "Default to human review when uncertain",
      expression: "confidence < threshold",
      outcome: "review" as DecisionOutcome,
      isAiGenerated: true,
    });
    rules.push({
      id: "rule-default-allow",
      label: "Allow low-risk matches",
      expression: "confidence >= threshold AND policy_match = true",
      outcome: "allow" as DecisionOutcome,
      isAiGenerated: true,
    });
  }

  const possibleOutcomes: DecisionOutcome[] = ["allow", "review", "block"];
  const riskLevel = inferRiskLevel(purpose, inputs);
  const approvalLevel = inferApprovalLevel(purpose, rules);
  const createdAt = new Date().toISOString();

  return {
    name,
    purpose,
    decisionType: params.decisionType ?? "custom",
    riskLevel,
    approvalLevel,
    possibleOutcomes,
    status: "draft",
    createdAt,
    config: {
      decisionQuestion: purpose,
      inputs,
      rules,
      actions: ["Record decision", "Route to approval if required", "Write audit log"],
      approvalWhen: inferApprovalWhen(purpose),
      workflow: defaultWorkflow(name),
      aiReasoningEnabled: true,
      riskLevel,
      approvalLevel,
      possibleOutcomes,
      generatedAt: createdAt,
    },
  };
}
