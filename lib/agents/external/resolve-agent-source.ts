import { platformDisplayName } from "@/lib/agents/platform/connection-options";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { readExternalConnection } from "./connection-store";

export interface AgentSourceBadge {
  origin: "zelta" | "external" | "demo";
  label: string;
}

export function resolveAgentSourceBadge(
  agent: Pick<BuilderAgentRecord, "source" | "safetySettings" | "slug"> | null
): AgentSourceBadge | null {
  if (!agent) return null;

  const external = readExternalConnection(agent.safetySettings);
  if (external) {
    return {
      origin: external.origin === "zelta" ? "zelta" : "external",
      label:
        external.origin === "zelta"
          ? "Wave"
          : `External · ${platformDisplayName(external.platform)}`,
    };
  }

  if (agent.source.startsWith("external-")) {
    const platform = agent.source.replace("external-", "");
    return {
      origin: "external",
      label: `External · ${platformDisplayName(platform)}`,
    };
  }

  if (agent.source === "zelta-builder" || agent.source.includes("zelta")) {
    return { origin: "zelta", label: "Wave" };
  }

  return { origin: "external", label: "External" };
}
