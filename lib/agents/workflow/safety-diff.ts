import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import {
  inferCapabilityIdsFromTools,
  capabilityToEntries,
} from "@/lib/agents/builder-capabilities";
import { missionConfigEnablesLock } from "@/lib/safety/mission";
import type { AgentWorkflowGraph, WorkflowSafetyDiff } from "./types";

export function diffWorkflowSafety(
  graph: AgentWorkflowGraph,
  previousTools: string[],
  safetySettings?: AgentSafetySettings
): WorkflowSafetyDiff {
  const workflowTools = graph.nodes
    .filter((node) => node.type === "tool" && node.config.toolName)
    .map((node) => node.config.toolName!.trim().toLowerCase());

  if (graph.nodes.some((node) => node.type === "output_email")) {
    workflowTools.push("send_email");
  }

  const current = new Set(workflowTools);
  const previous = new Set(previousTools.map((tool) => tool.trim().toLowerCase()));
  const newTools = [...current].filter((tool) => !previous.has(tool));
  const newCapabilities = inferCapabilityIdsFromTools(newTools);

  const missionTools = new Set(
    (safetySettings?.mission?.allowedTools ?? []).map((tool) => tool.toLowerCase())
  );
  const missionLocked = missionConfigEnablesLock(safetySettings?.mission);

  const outsideMission =
    missionLocked &&
    newTools.some((tool) => missionTools.size > 0 && !missionTools.has(tool));

  const highRiskTools = newTools.filter((tool) =>
    ["issue_refund", "update_crm_record", "delete_record", "query_supabase"].includes(tool)
  );

  const requiresSafetyReview = newTools.length > 0;
  let message: string | null = null;

  if (newTools.length > 0) {
    const labels = capabilityToEntries(inferCapabilityIdsFromTools(newTools))
      .map((item) => item.label)
      .join(", ");
    message = `New capability added: ${labels || newTools.join(", ")}. Wave will evaluate mission, policy, and approval requirements before this step runs.`;
  }

  if (outsideMission) {
    message =
      "New step adds tools outside the agent mission lock. Update mission settings or run Verify Agent.";
  }

  if (highRiskTools.length > 0) {
    message = `High-risk capability added (${highRiskTools.join(", ")}). Approval may be required before execution.`;
  }

  return {
    newTools,
    newCapabilities,
    requiresSafetyReview,
    message,
  };
}
