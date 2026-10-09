import type { AgentWorkflowGraph, WorkflowVersionSnapshot } from "./types";

const MAX_VERSIONS = 20;

export function snapshotWorkflowVersion(
  graph: AgentWorkflowGraph,
  existing: WorkflowVersionSnapshot[] | undefined,
  note?: string
): WorkflowVersionSnapshot[] {
  const next: WorkflowVersionSnapshot = {
    id: `ver-${Date.now()}`,
    createdAt: new Date().toISOString(),
    graph: JSON.parse(JSON.stringify(graph)) as AgentWorkflowGraph,
    note,
  };
  return [next, ...(existing ?? [])].slice(0, MAX_VERSIONS);
}
