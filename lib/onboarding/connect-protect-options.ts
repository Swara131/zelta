export type AgentPlatformId =
  | "zelta"
  | "langchain"
  | "other-platform"
  | "custom"
  | "unsure";

export type ConnectSupportStatus = "setup_required" | "coming_soon" | "guide";

export interface AgentPlatformOption {
  id: AgentPlatformId;
  number: string;
  title: string;
  description: string;
  status: ConnectSupportStatus;
  resultTitle: string;
  resultBody: string;
  /** Shown on the result screen — honest about what works today. */
  resultDetail?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** Agent types for the Connect & Protect onboarding — no fake integrations. */
export const AGENT_PLATFORM_OPTIONS: readonly AgentPlatformOption[] = [
  {
    id: "zelta",
    number: "1",
    title: "Built with Wave",
    description: "Your agent will call Wave before taking important actions.",
    status: "setup_required",
    resultTitle: "Connect your agent to Wave",
    resultBody:
      "Wave protects agents through a simple connection — your agent tells Wave what it wants to do, and Wave allows, pauses, or blocks it.",
    resultDetail:
      "Next you'll create a connection key and add a few lines to your agent. No complex infrastructure required.",
    ctaLabel: "Continue to setup",
    ctaHref: "/onboarding/connect/wizard?platform=zelta",
  },
  {
    id: "langchain",
    number: "2",
    title: "Built with LangChain",
    description: "Your agent runs on LangChain or LangGraph.",
    status: "setup_required",
    resultTitle: "Connection setup required",
    resultBody:
      "Wave does not have a one-click LangChain plugin yet. You can still protect your agent by calling Wave from your LangChain tools before they run.",
    resultDetail:
      "On the next screen you'll get connection instructions and code examples for your developer.",
    ctaLabel: "Continue to setup",
    ctaHref: "/onboarding/connect/wizard?platform=langchain",
  },
  {
    id: "other-platform",
    number: "3",
    title: "Built with another platform",
    description: "For example Make, n8n, Zapier, or a SaaS AI product.",
    status: "setup_required",
    resultTitle: "Connect your platform agent",
    resultBody:
      "Many third-party platforms can connect to Wave through HTTP — your agent sends actions to Wave before they run.",
    resultDetail:
      "Next you'll create a connection key and see webhook or HTTP setup examples for tools like Make, n8n, or Zapier.",
    ctaLabel: "Continue to setup",
    ctaHref: "/onboarding/connect/wizard?platform=other-platform",
  },
  {
    id: "custom",
    number: "4",
    title: "Custom AI agent",
    description: "You or your team built the agent yourselves.",
    status: "setup_required",
    resultTitle: "Connect your custom agent",
    resultBody:
      "Wave works with any agent that can send actions over HTTP — including scripts, apps, and internal tools.",
    resultDetail:
      "Next you'll create a connection key and see copy-paste examples for your developer.",
    ctaLabel: "Continue to setup",
    ctaHref: "/onboarding/connect/wizard?platform=custom",
  },
  {
    id: "unsure",
    number: "5",
    title: "I'm not sure",
    description: "Not sure how your agent was built? We'll help you figure it out.",
    status: "guide",
    resultTitle: "Let's find the right fit",
    resultBody:
      "Most agents fall into one of these categories. Pick the closest match — you can always change it later.",
    resultDetail:
      "If someone on your team built the agent, choose Custom. If you use a tool like LangChain, choose LangChain. If you subscribed to an AI product, choose Another platform.",
  },
] as const;

export function getAgentPlatformOption(
  id: AgentPlatformId
): AgentPlatformOption | undefined {
  return AGENT_PLATFORM_OPTIONS.find((option) => option.id === id);
}

export const BUILD_AGENT_COPY = {
  title: "Build an AI Agent",
  body: "Describe what you want your agent to do. Wave will suggest tools and protection rules in plain language.",
  detail:
    "You can refine the agent before creating it. Connection setup happens after you click Create Agent.",
  status: "ready" as const,
  ctaLabel: "Open Agent Builder",
  ctaHref: "/agents/build",
};
