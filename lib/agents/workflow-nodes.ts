import type { AgentInterpretation } from "@/lib/agents/builder-types";
import { labelAgentTool } from "@/lib/agents/tool-labels";

export type WorkflowNodeKind = "trigger" | "ai" | "tool" | "decision" | "output";

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  subtitle?: string;
}

export interface WorkflowAgentSource {
  name: string;
  goal?: string | null;
  instructions?: string | null;
  tools?: string[];
  capabilityLabels?: string[];
  scheduleSummary?: string | null;
  triggerType?: string;
  deliveryLabel?: string | null;
  protected?: boolean;
}

export function buildWorkflowFromInterpretation(
  interpretation: AgentInterpretation
): WorkflowNode[] {
  const nodes: WorkflowNode[] = [
    {
      id: "trigger",
      kind: "trigger",
      title: "Trigger",
      subtitle: interpretation.scheduleSummary || labelTrigger(interpretation.triggerType),
    },
    {
      id: "ai",
      kind: "ai",
      title: "AI Agent",
      subtitle: interpretation.displayName,
    },
  ];

  const toolLabels = interpretation.capabilities.length
    ? interpretation.capabilities.map((item) => item.label)
    : interpretation.tools.map((tool) => labelAgentTool(tool));

  for (const [index, label] of toolLabels.slice(0, 3).entries()) {
    nodes.push({
      id: `tool-${index}`,
      kind: "tool",
      title: label,
      subtitle: "Configured tool",
    });
  }

  nodes.push({
    id: "decision",
    kind: "decision",
    title: "Safety check",
    subtitle: interpretation.protectionSummary || "Wave reviews risky actions",
  });

  nodes.push({
    id: "output",
    kind: "output",
    title: "Output",
    subtitle: deliveryLabel(interpretation.deliveryMode),
  });

  return nodes;
}

export function buildWorkflowFromAgent(agent: WorkflowAgentSource): WorkflowNode[] {
  const nodes: WorkflowNode[] = [
    {
      id: "trigger",
      kind: "trigger",
      title: "Trigger",
      subtitle:
        agent.scheduleSummary?.trim() ||
        labelTrigger(agent.triggerType ?? "webhook"),
    },
    {
      id: "ai",
      kind: "ai",
      title: "AI Agent",
      subtitle: agent.name,
    },
  ];

  const toolLabels =
    agent.capabilityLabels?.length
      ? agent.capabilityLabels
      : (agent.tools ?? []).map((tool) => labelAgentTool(tool));

  for (const [index, label] of toolLabels.slice(0, 3).entries()) {
    nodes.push({
      id: `tool-${index}`,
      kind: "tool",
      title: label,
      subtitle: "Tool step",
    });
  }

  nodes.push({
    id: "decision",
    kind: "decision",
    title: "Safety check",
    subtitle: agent.protected === false ? "Protection optional" : "Wave Protection enabled",
  });

  nodes.push({
    id: "output",
    kind: "output",
    title: "Output",
    subtitle: agent.deliveryLabel ?? "Deliver results to your team",
  });

  return nodes;
}

function labelTrigger(triggerType: string): string {
  switch (triggerType) {
    case "email":
      return "Email trigger";
    case "schedule":
      return "Scheduled run";
    default:
      return "Webhook / manual run";
  }
}

function deliveryLabel(mode: string): string {
  switch (mode) {
    case "email":
      return "Send via email";
    case "both":
      return "Email + notifications";
    case "notification":
      return "In-app notification";
    default:
      return "Deliver results";
  }
}
