import {
  inferCapabilityIdsFromTools,
  type BuilderCapabilityId,
} from "@/lib/agents/builder-capabilities";
import { resolveToolName } from "@/lib/agents/tools/catalog";
import type { AgentDeliveryMode } from "@/lib/agents/delivery/types";
import type { AgentScheduleConfig } from "@/lib/agents/runtime-types";
import type {
  AgentWorkflowGraph,
  WorkflowAgentConfigPatch,
  WorkflowGraphNode,
} from "./types";

function sortedNodes(graph: AgentWorkflowGraph): WorkflowGraphNode[] {
  return [...graph.nodes].sort((a, b) => a.position - b.position);
}

function triggerFromGraph(nodes: WorkflowGraphNode[]): {
  triggerType: "email" | "webhook" | "schedule";
  schedule: AgentScheduleConfig;
  scheduleSummary: string;
  timezone: string;
} {
  const trigger = nodes.find((node) => node.category === "trigger");
  if (!trigger) {
    return {
      triggerType: "webhook",
      schedule: { when: "manual", triggerType: "webhook" },
      scheduleSummary: "When you run it",
      timezone: "UTC",
    };
  }

  const config = trigger.config;
  const schedule = config.schedule ?? {};
  const timezone = schedule.timezone ?? "UTC";

  if (trigger.type === "trigger_schedule" || config.triggerType === "schedule") {
    const time = schedule.time ?? "09:00";
    const when = schedule.when ?? "daily";
    return {
      triggerType: "schedule",
      schedule: { when, time, days: schedule.days, triggerType: "schedule" },
      scheduleSummary: trigger.description || `Scheduled at ${time}`,
      timezone,
    };
  }

  if (config.triggerType === "email" || trigger.type === "trigger_webhook") {
    if (config.triggerType === "email") {
      return {
        triggerType: "email",
        schedule: { when: "on_event", triggerType: "email" },
        scheduleSummary: trigger.description || "When a new email arrives",
        timezone,
      };
    }
  }

  return {
    triggerType: "webhook",
    schedule: { when: "manual", triggerType: "webhook" },
    scheduleSummary: trigger.description || "When you run it",
    timezone,
  };
}

function toolsFromGraph(nodes: WorkflowGraphNode[]): string[] {
  const tools = new Set<string>();
  for (const node of nodes) {
    if (node.type === "tool" && node.config.toolName) {
      tools.add(resolveToolName(node.config.toolName));
    }
    if (node.type === "output_email") {
      tools.add("send_email");
    }
  }
  return [...tools];
}

function deliveryFromGraph(nodes: WorkflowGraphNode[]): AgentDeliveryMode {
  const hasEmail =
    nodes.some((node) => node.type === "output_email") ||
    nodes.some((node) => node.config.toolName === "send_email");
  const hasWhatsApp = nodes.some(
    (node) => node.config.toolName === "send_whatsapp_message"
  );
  if (hasEmail && hasWhatsApp) return "both";
  if (hasEmail) return "email";
  if (hasWhatsApp) return "whatsapp";
  if (nodes.some((node) => node.type === "output_notification")) return "notification";
  return "none";
}

function buildInstructions(nodes: WorkflowGraphNode[], goal: string): string {
  const steps = [...nodes]
    .sort((a, b) => a.position - b.position)
    .filter(
      (node) =>
        node.category === "tool" ||
        node.category === "ai" ||
        node.category === "output"
    )
    .map((node) => `- ${node.name}: ${node.description}`)
    .join("\n");

  if (!steps) return goal;
  return `${goal}\n\nWorkflow steps:\n${steps}`;
}

export function syncWorkflowToAgentConfig(
  graph: AgentWorkflowGraph,
  base?: Partial<WorkflowAgentConfigPatch>
): WorkflowAgentConfigPatch {
  const nodes = sortedNodes(graph);
  const trigger = triggerFromGraph(nodes);
  const tools = toolsFromGraph(nodes);
  const capabilityIds = [
    ...new Set([
      ...(base?.capabilityIds ?? []),
      ...inferCapabilityIdsFromTools(tools),
    ]),
  ] as BuilderCapabilityId[];

  const aiNode =
    nodes.find((node) => node.type === "ai_reasoning") ??
    nodes.find((node) => node.category === "ai");

  const goal =
    aiNode?.config.goal?.trim() ||
    aiNode?.description?.trim() ||
    base?.goal?.trim() ||
    "Run the configured workflow";

  const instructions = buildInstructions(nodes, goal);

  return {
    displayName: base?.displayName,
    goal,
    instructions,
    scheduleSummary: trigger.scheduleSummary,
    schedule: trigger.schedule,
    timezone: trigger.timezone,
    capabilityIds: capabilityIds.length ? capabilityIds : inferCapabilityIdsFromTools(tools),
    tools,
    triggerType: trigger.triggerType,
    suggestedThreshold: base?.suggestedThreshold ?? 5000,
    deliveryMode: deliveryFromGraph(nodes),
    destinationEmail: base?.destinationEmail ?? null,
  };
}

export function reorderWorkflowNodes(
  graph: AgentWorkflowGraph,
  orderedIds: string[]
): AgentWorkflowGraph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = orderedIds
    .map((id, index) => {
      const node = byId.get(id);
      if (!node) return null;
      return { ...node, position: index };
    })
    .filter(Boolean) as WorkflowGraphNode[];

  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${index}`,
    source: node.id,
    target: nodes[index + 1]!.id,
  }));

  return { ...graph, nodes, edges };
}

export function connectWorkflowLinearly(graph: AgentWorkflowGraph): AgentWorkflowGraph {
  const nodes = sortedNodes(graph);
  return {
    ...graph,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `edge-${index}`,
      source: node.id,
      target: nodes[index + 1]!.id,
    })),
  };
}
