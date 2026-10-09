import type { DecisionAgentRecord } from "@/lib/decision-agents/types";
import type { AgentRequirementSnapshot, RequirementStage } from "./types";

export function snapshotFromDecisionAgent(
  agent: DecisionAgentRecord,
  extras?: { stage?: RequirementStage }
): AgentRequirementSnapshot {
  return {
    agentId: agent.slug,
    name: agent.name,
    kind: "decision",
    goal: agent.purpose,
    description: agent.purpose,
    instructions: agent.config.decisionQuestion,
    tools: agent.config.actions,
    decisionConfig: agent.config,
    protectionConfigured: Boolean(
      agent.config.approvalWhen || agent.config.riskLevel || agent.config.rules.length
    ),
    stage: extras?.stage ?? "setup",
  };
}
