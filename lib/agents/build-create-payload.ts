import type { AgentBuildView } from "@/lib/agent-builder/build-response";
import { slugifyAgentId } from "@/lib/agent-builder/slug";
import { normalizeAgentBuildForCreate } from "@/lib/agent-builder/validate-agent-build";
import type { AllowedTriggerType } from "@/lib/xai/parse-agent-build";
import type { CreateBuilderAgentInput } from "./types";

export function buildCreateAgentPayload(build: AgentBuildView): CreateBuilderAgentInput {
  const normalized = normalizeAgentBuildForCreate(build);
  const slugName = slugifyAgentId(normalized.spec.agentId || normalized.spec.name);

  return {
    name: slugName,
    description: normalized.sentence?.trim() || normalized.spec.summary || normalized.spec.purpose,
    source: "zelta-builder",
    tools: normalized.spec.tools.map((tool) => tool.toolName),
    triggerType: (normalized.triggerType ?? "webhook") as AllowedTriggerType,
    suggestedThreshold:
      normalized.suggestedThreshold ?? normalized.suggestedThresholdInr ?? undefined,
  };
}
