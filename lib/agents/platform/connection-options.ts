/** Shared platform connection options — used by Connect, Test, and Deploy flows. */

export type AgentConnectionPlatformId =
  | "zelta"
  | "copilot"
  | "langchain"
  | "n8n"
  | "other"
  | "unsure";

export interface AgentConnectionOption {
  id: AgentConnectionPlatformId;
  title: string;
  description: string;
  href: string;
}

export const AGENT_CONNECTION_OPTIONS: readonly AgentConnectionOption[] = [
  {
    id: "zelta",
    title: "Built with Wave",
    description: "Connect an agent already created in Wave via API key.",
    href: "/integrations?connect=1",
  },
  {
    id: "copilot",
    title: "GitHub Copilot",
    description: "Connect an agent you built using GitHub Copilot.",
    href: "/onboarding/connect?platform=copilot",
  },
  {
    id: "langchain",
    title: "LangChain",
    description: "Connect via REST API or SDK using the Wave gateway.",
    href: "/onboarding/connect?platform=langchain",
  },
  {
    id: "n8n",
    title: "n8n",
    description: "Connect via webhook or HTTP node through the Wave gateway.",
    href: "/onboarding/connect?platform=n8n",
  },
  {
    id: "other",
    title: "Another platform",
    description: "Connect any agent that can call the Wave REST API.",
    href: "/onboarding/connect?platform=other",
  },
  {
    id: "unsure",
    title: "I'm not sure",
    description: "Walk through the connection wizard step by step.",
    href: "/onboarding/connect/wizard",
  },
] as const;

/** Platforms shown in Deploy Existing Agent (no "unsure"). */
export const DEPLOY_PLATFORM_OPTIONS = AGENT_CONNECTION_OPTIONS.filter(
  (option) => option.id !== "unsure"
);

export function getConnectionOption(id: AgentConnectionPlatformId): AgentConnectionOption | undefined {
  return AGENT_CONNECTION_OPTIONS.find((option) => option.id === id);
}

export function platformDisplayName(id: AgentConnectionPlatformId | string): string {
  switch (id) {
    case "zelta":
      return "Wave";
    case "copilot":
      return "GitHub Copilot";
    case "langchain":
      return "LangChain";
    case "n8n":
      return "n8n";
    case "other":
      return "External";
    case "unsure":
      return "Unknown";
    default:
      return id;
  }
}
