import type { AgentSpec } from "./types";
import { protectionFromAgentSpec } from "@/lib/protection/plain-english";

export interface CreatedAgentViewModel {
  name: string;
  purpose: string;
  status: "Protected";
  statusDetail: "Active";
  protectionMode: string;
  allowedCount: number;
  reviewCount: number;
  blockedCount: number;
}

export const AGENT_CREATED_EXPLANATION =
  "Wave sits between your AI agent and the actions it wants to perform. Before an important action happens, Wave decides whether to allow it, ask you for approval, or block it.";

export const AGENT_CREATED_NEXT_STEP =
  "Next step: Connect your agent or test a simulated action.";

export function buildCreatedAgentViewModel(spec: AgentSpec): CreatedAgentViewModel {
  const protection = protectionFromAgentSpec(spec);

  return {
    name: spec.name,
    purpose: spec.summary.trim() || spec.purpose.trim(),
    status: "Protected",
    statusDetail: "Active",
    protectionMode: "Allow · Review · Block",
    allowedCount: protection.allowed.length,
    reviewCount: protection.askFirst.length,
    blockedCount: protection.blocked.length,
  };
}
