import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import type { AgentWorkflowGraph, AgentWorkflowState } from "./types";

export interface SafetySettingsWithWorkflow extends AgentSafetySettings {
  workflowState?: AgentWorkflowState;
}

export function readWorkflowState(
  safetySettings: AgentSafetySettings | null | undefined
): AgentWorkflowState | null {
  const extended = safetySettings as SafetySettingsWithWorkflow | undefined;
  return extended?.workflowState ?? null;
}

export function writeWorkflowState(
  safetySettings: AgentSafetySettings,
  state: AgentWorkflowState
): AgentSafetySettings {
  return {
    ...safetySettings,
    workflowState: state,
  };
}

export function createInitialWorkflowState(
  graph: AgentWorkflowGraph
): AgentWorkflowState {
  return {
    published: graph,
    draft: null,
    lastVerifiedAt: null,
    verificationStatus: "unverified",
  };
}

export function beginWorkflowDraft(state: AgentWorkflowState): AgentWorkflowState {
  return {
    ...state,
    draft: state.draft ?? JSON.parse(JSON.stringify(state.published)),
    verificationStatus: "pending",
  };
}

export function activeWorkflowGraph(state: AgentWorkflowState | null): AgentWorkflowGraph | null {
  if (!state) return null;
  return state.draft ?? state.published;
}

export function publishWorkflowDraft(state: AgentWorkflowState): AgentWorkflowState {
  if (!state.draft) return state;
  return {
    ...state,
    published: state.draft,
    draft: null,
    lastVerifiedAt: new Date().toISOString(),
    verificationStatus: "valid",
  };
}

export function discardWorkflowDraft(state: AgentWorkflowState): AgentWorkflowState {
  return {
    ...state,
    draft: null,
    verificationStatus: state.lastVerifiedAt ? "valid" : "unverified",
  };
}
