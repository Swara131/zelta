import { getToolDefinition } from "@/lib/agents/tools/catalog";
import { toolConnectionsReady } from "@/lib/agents/tools/connections";
import { computeWorkflowSafetyScore, isHighRiskWorkflow } from "./activation";
import type {
  AgentWorkflowGraph,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from "./types";

function detectCycle(graph: AgentWorkflowGraph): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const node of graph.nodes) {
    if (dfs(node.id)) return true;
  }
  return false;
}

function orphanNodeIds(graph: AgentWorkflowGraph): string[] {
  if (graph.nodes.length <= 1) return [];
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  return graph.nodes
    .filter((node) => !connected.has(node.id))
    .map((node) => node.id);
}

export function validateWorkflowGraph(
  graph: AgentWorkflowGraph,
  options?: {
    emailConnected?: boolean;
    webSearchConnected?: boolean;
  }
): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const nodes = [...graph.nodes].sort((a, b) => a.position - b.position);
  const triggers = nodes.filter((node) => node.category === "trigger");
  const outputs = nodes.filter((node) => node.category === "output");
  const toolNodes = nodes.filter((node) => node.type === "tool");

  if (triggers.length === 0) {
    issues.push({
      id: "missing-trigger",
      severity: "error",
      message: "Workflow needs a trigger step.",
    });
  }

  if (triggers.length > 1) {
    issues.push({
      id: "multiple-triggers",
      severity: "warning",
      message: "Multiple triggers found. Only the first trigger will be used.",
      nodeId: triggers[1]?.id,
    });
  }

  if (outputs.length === 0) {
    issues.push({
      id: "missing-output",
      severity: "warning",
      message: "Add an output step so results are delivered.",
    });
  }

  for (const orphanId of orphanNodeIds(graph)) {
    issues.push({
      id: `orphan-${orphanId}`,
      severity: "error",
      message: "Disconnected step — connect it to the workflow.",
      nodeId: orphanId,
    });
  }

  if (detectCycle(graph)) {
    issues.push({
      id: "cycle",
      severity: "error",
      message: "Circular workflow paths are not supported yet.",
    });
  }

  for (const node of toolNodes) {
    const toolName = node.config.toolName;
    if (!toolName) {
      if (node.type === "placeholder_tool") continue;
      issues.push({
        id: `tool-config-${node.id}`,
        severity: "error",
        message: "Tool step is missing a tool selection.",
        nodeId: node.id,
      });
      continue;
    }

    const catalogTool = getToolDefinition(toolName);
    if (!catalogTool) {
      if (node.config.placeholderIntegration) {
        issues.push({
          id: `placeholder-${node.id}`,
          severity: "warning",
          message: `${node.name} is a sample connector and is not executable.`,
          nodeId: node.id,
        });
        continue;
      }
      issues.push({
        id: `unknown-tool-${node.id}`,
        severity: "error",
        message: `Tool "${toolName}" is not supported by Wave.`,
        nodeId: node.id,
      });
      continue;
    }

    if (!toolConnectionsReady(catalogTool)) {
      const settingsPath =
        catalogTool.permissions.find((item) => item.settingsPath)?.settingsPath ??
        "/settings?tab=integrations";
      issues.push({
        id: `connection-${node.id}`,
        severity: "error",
        message: `${catalogTool.label} step needs a connected provider.`,
        nodeId: node.id,
        actionLabel: `Connect ${catalogTool.label}`,
        actionHref: settingsPath,
      });
    }
  }

  const emailOutput = nodes.find((node) => node.type === "output_email");
  if (emailOutput && options?.emailConnected === false) {
    issues.push({
      id: "email-output-connection",
      severity: "error",
      message: "Email step needs a connected email provider.",
      nodeId: emailOutput.id,
      actionLabel: "Connect Email",
      actionHref: "/settings?tab=integrations&provider=email",
    });
  }

  const hasWebSearch = toolNodes.some((node) => node.config.toolName === "web_search");
  if (hasWebSearch && options?.webSearchConnected === false) {
    const node = toolNodes.find((item) => item.config.toolName === "web_search");
    issues.push({
      id: "web-search-connection",
      severity: "error",
      message: "Web search step needs a connected search provider.",
      nodeId: node?.id,
      actionLabel: "Connect Web Search",
      actionHref: "/settings?tab=integrations&provider=web_search",
    });
  }

  for (const node of nodes.filter((item) => item.type === "loop")) {
    const maxIterations = Number(node.config.maxIterations ?? 0);
    if (!Number.isFinite(maxIterations) || maxIterations < 1 || maxIterations > 100) {
      issues.push({
        id: `loop-bound-${node.id}`,
        severity: "error",
        message: "Loop steps need a max iteration limit between 1 and 100.",
        nodeId: node.id,
      });
    } else {
      issues.push({
        id: `loop-runtime-${node.id}`,
        severity: "warning",
        message: "Loop steps are stored but not executed by the runtime yet.",
        nodeId: node.id,
      });
    }
  }

  for (const node of toolNodes) {
    if (node.config.permissionLevel === "automatic" && node.config.toolName) {
      const highImpact = ["issue_refund", "send_email", "send_whatsapp_message", "update_crm_record"];
      if (highImpact.includes(node.config.toolName)) {
        issues.push({
          id: `auto-act-${node.id}`,
          severity: "warning",
          message: `${node.name} is set to act automatically. Server policy still applies.`,
          nodeId: node.id,
        });
      }
    }
  }

  if (nodes.some((node) => node.type === "placeholder_tool" || node.config.placeholderIntegration)) {
    issues.push({
      id: "placeholder-tools",
      severity: "warning",
      message: "Sample connectors are display-only and will not execute.",
    });
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  const highRisk = isHighRiskWorkflow(graph);
  const result: WorkflowValidationResult = {
    valid: !hasErrors,
    issues,
    highRisk,
    safetyScore: 0,
  };
  result.safetyScore = computeWorkflowSafetyScore(graph, result);
  return result;
}

export function applyValidationStatusToGraph(
  graph: AgentWorkflowGraph,
  result: WorkflowValidationResult
): AgentWorkflowGraph {
  const issuesByNode = new Map<string, WorkflowValidationIssue[]>();
  for (const issue of result.issues) {
    if (!issue.nodeId) continue;
    const list = issuesByNode.get(issue.nodeId) ?? [];
    list.push(issue);
    issuesByNode.set(issue.nodeId, list);
  }

  const nodes = graph.nodes.map((node) => {
    const nodeIssues = issuesByNode.get(node.id) ?? [];
    if (nodeIssues.some((issue) => issue.severity === "error")) {
      return { ...node, status: "error" as const };
    }
    if (nodeIssues.some((issue) => issue.severity === "warning")) {
      return { ...node, status: "warning" as const };
    }
    if (node.type === "tool" || node.type === "output_email") {
      return { ...node, status: "valid" as const };
    }
    return node;
  });

  return { ...graph, nodes };
}

export function summarizeValidation(result: WorkflowValidationResult): string {
  if (result.valid) return "✓ Workflow valid";
  const errorCount = result.issues.filter((issue) => issue.severity === "error").length;
  const warningCount = result.issues.filter((issue) => issue.severity === "warning").length;
  const total = errorCount + warningCount;
  return `⚠ ${total} issue${total === 1 ? "" : "s"} need attention`;
}
