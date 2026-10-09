import type { AgentWorkflowGraph } from "@/lib/agents/workflow/types";

export interface WorkflowSignals {
  hasWorkflow: boolean;
  hasTrigger: boolean;
  scheduledTrigger: boolean;
  tools: string[];
  hasAi: boolean;
  hasEmailOutput: boolean;
  hasSafety: boolean;
  hasDecision: boolean;
  hasCrm: boolean;
}

export function extractWorkflowSignals(graph: AgentWorkflowGraph | null | undefined): WorkflowSignals {
  if (!graph?.nodes?.length) {
    return {
      hasWorkflow: false,
      hasTrigger: false,
      scheduledTrigger: false,
      tools: [],
      hasAi: false,
      hasEmailOutput: false,
      hasSafety: false,
      hasDecision: false,
      hasCrm: false,
    };
  }

  const tools = graph.nodes
    .map((node) => node.config?.toolName)
    .filter((tool): tool is string => Boolean(tool));

  const hasTrigger = graph.nodes.some(
    (node) =>
      node.category === "trigger" ||
      (typeof node.type === "string" && node.type.startsWith("trigger_"))
  );

  return {
    hasWorkflow: true,
    hasTrigger: hasTrigger || graph.nodes.length > 0,
    scheduledTrigger: graph.nodes.some((node) => node.type === "trigger_schedule"),
    tools,
    hasAi: graph.nodes.some((node) => node.category === "ai"),
    hasEmailOutput:
      graph.nodes.some((node) => node.type === "output_email") || tools.includes("send_email"),
    hasSafety: graph.nodes.some((node) => node.category === "safety"),
    hasDecision: graph.nodes.some(
      (node) => node.type === "condition" || node.type === "ai_score" || node.type === "ai_classification"
    ),
    hasCrm: tools.includes("update_crm_record"),
  };
}
