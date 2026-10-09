import { generateWorkflowFromAgent } from "./generate-from-interpretation";
import {
  createInitialWorkflowState,
  readWorkflowState,
  writeWorkflowState,
} from "./persistence";
import type { AgentSafetySettings, BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { getAgentRequirements } from "@/lib/agents/requirements/engine";

export function seedWorkflowSafetySettings(agent: {
  name: string;
  goal?: string | null;
  description?: string;
  instructions?: string | null;
  tools?: string[];
  triggerType?: string;
  schedule?: BuilderAgentRecord["schedule"];
  timezone?: string;
  safetySettings: AgentSafetySettings;
}): AgentSafetySettings {
  if (readWorkflowState(agent.safetySettings)) {
    return agent.safetySettings;
  }

  const graph = generateWorkflowFromAgent({
    name: agent.name,
    goal: agent.goal ?? agent.description,
    instructions: agent.instructions,
    tools: agent.tools,
    triggerType: agent.triggerType,
    schedule: agent.schedule,
    timezone: agent.timezone,
    deliveryMode: agent.safetySettings.delivery?.mode,
  });

  const withWorkflow = writeWorkflowState(agent.safetySettings, createInitialWorkflowState(graph));
  const preview = getAgentRequirements({
    agentId: agent.name,
    name: agent.name,
    kind: "builder",
    goal: agent.goal ?? agent.description,
    description: agent.description,
    instructions: agent.instructions,
    tools: agent.tools ?? [],
    triggerType:
      agent.triggerType === "schedule" || agent.triggerType === "email"
        ? agent.triggerType
        : "webhook",
    schedule: agent.schedule ?? { when: "manual" },
    timezone: agent.timezone ?? "UTC",
    deliveryMode: agent.safetySettings.delivery?.mode ?? "notification",
    workflow: graph,
    safetySettings: withWorkflow,
    setupAnswers: agent.safetySettings.setupAnswers ?? {},
    stage: "setup",
  });

  return {
    ...withWorkflow,
    requirementManifest: {
      generatedAt: new Date().toISOString(),
      keys: preview.requirements.filter((item) => item.required).map((item) => item.key),
    },
  };
}
