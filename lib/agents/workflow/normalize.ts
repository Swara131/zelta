import type { AgentWorkflowGraph, WorkflowGraphEdge, WorkflowGraphNode } from "./types";
import { connectWorkflowLinearly } from "./sync-to-agent";
import { ensureNodeCoordinates } from "./layout";

export function normalizeWorkflowGraph(graph: AgentWorkflowGraph): AgentWorkflowGraph {
  const nodes = graph.nodes.map((node, index) =>
    ensureNodeCoordinates({ ...node, position: Number.isFinite(node.position) ? node.position : index }, index)
  );
  const ids = new Set(nodes.map((node) => node.id));
  const edges = (graph.edges ?? []).filter(
    (edge): edge is WorkflowGraphEdge =>
      Boolean(edge?.id && edge.source && edge.target) &&
      ids.has(edge.source) &&
      ids.has(edge.target) &&
      edge.source !== edge.target
  );

  if (edges.length === 0 && nodes.length > 1) {
    return connectWorkflowLinearly({ ...graph, nodes });
  }

  return { ...graph, nodes, edges };
}

export function duplicateWorkflowNode(
  graph: AgentWorkflowGraph,
  nodeId: string
): AgentWorkflowGraph {
  const source = graph.nodes.find((node) => node.id === nodeId);
  if (!source) return graph;
  const copy: WorkflowGraphNode = {
    ...source,
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${source.name} copy`,
    x: (source.x ?? 72) + 36,
    y: (source.y ?? 48) + 36,
    position: graph.nodes.length,
  };
  return { ...graph, nodes: [...graph.nodes, copy] };
}
