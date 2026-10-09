import type { WorkflowGraphNode } from "./types";

export interface WorkflowRunStepLike {
  key: string;
  label: string;
  detail: string | null;
  status: string;
}

export function matchWorkflowNodeToStep(
  node: WorkflowGraphNode,
  steps: WorkflowRunStepLike[]
): "waiting" | "running" | "succeeded" | "failed" | "needs_approval" {
  const tool = node.config?.toolName ?? (node.type === "output_email" ? "send_email" : "");
  const haystack = steps.map((step) => `${step.key} ${step.label} ${step.detail ?? ""}`.toLowerCase());
  const failed = haystack.some((text) => text.includes("fail") || text.includes("error"));
  if (haystack.some((text) => text.includes("waiting for approval") || text.includes("needs_approval"))) {
    return "needs_approval";
  }

  if (tool && haystack.some((text) => text.includes(tool.replace(/_/g, " ")) || text.includes(tool))) {
    if (failed && haystack.some((text) => text.includes(tool))) return "failed";
    const running = steps.some(
      (step) =>
        (step.status === "running" || step.key.endsWith(".start")) &&
        `${step.key} ${step.label}`.toLowerCase().includes(tool.replace(/_/g, " "))
    );
    if (running) return "running";
    return "succeeded";
  }

  if (node.category === "trigger" && steps.some((step) => step.key === "run.start")) {
    return "succeeded";
  }
  if (node.category === "ai" && steps.some((step) => /analyz|summar|reason|creat/i.test(step.label))) {
    return steps.some((step) => step.key === "run.finished") ? "succeeded" : "running";
  }
  if (node.category === "output") {
    if (haystack.some((text) => text.includes("email") && text.includes("fail"))) return "failed";
    if (haystack.some((text) => text.includes("email") || text.includes("whatsapp") || text.includes("deliver"))) {
      return "succeeded";
    }
  }
  if (steps.some((step) => step.key === "run.finished")) return "succeeded";
  if (steps.length > 0 && node.position === 0) return "succeeded";
  return "waiting";
}
