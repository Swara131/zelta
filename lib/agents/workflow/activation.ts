import { HIGH_IMPACT_WORKFLOW_TOOLS } from "./types";
import type { AgentWorkflowGraph, AgentWorkflowState, WorkflowValidationResult } from "./types";

export class WorkflowActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowActivationError";
  }
}

export function workflowHasHighImpactTools(graph: AgentWorkflowGraph): boolean {
  return graph.nodes.some((node) => {
    const tool = node.config.toolName;
    return Boolean(
      tool && HIGH_IMPACT_WORKFLOW_TOOLS.includes(tool as (typeof HIGH_IMPACT_WORKFLOW_TOOLS)[number])
    );
  });
}

export function workflowHasApprovalGate(graph: AgentWorkflowGraph): boolean {
  return graph.nodes.some(
    (node) =>
      node.type === "safety_gate" ||
      node.type === "safety_approval" ||
      node.category === "safety"
  );
}

export function isHighRiskWorkflow(graph: AgentWorkflowGraph): boolean {
  return workflowHasHighImpactTools(graph) && !workflowHasApprovalGate(graph);
}

export function computeWorkflowSafetyScore(
  graph: AgentWorkflowGraph,
  validation: WorkflowValidationResult
): number {
  let score = 82;
  if (isHighRiskWorkflow(graph)) score -= 28;
  if (workflowHasHighImpactTools(graph) && workflowHasApprovalGate(graph)) score += 8;
  score -= validation.issues.filter((issue) => issue.severity === "error").length * 12;
  score -= validation.issues.filter((issue) => issue.severity === "warning").length * 3;
  return Math.max(12, Math.min(100, score));
}

export function assertWorkflowCanActivate(params: {
  validation: WorkflowValidationResult;
  graph: AgentWorkflowGraph;
  safetyReviewedAt?: string | null;
}): void {
  if (!params.validation.valid) {
    throw new WorkflowActivationError("Fix workflow issues before publishing.");
  }
  if (isHighRiskWorkflow(params.graph) && !params.safetyReviewedAt) {
    throw new WorkflowActivationError(
      "Complete the safety review before activating a high-risk workflow."
    );
  }
}

export function markWorkflowSafetyReviewed(state: AgentWorkflowState): AgentWorkflowState {
  return {
    ...state,
    safetyReviewedAt: new Date().toISOString(),
  };
}
