import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import type { AgentLifecycleProgress } from "./agent-lifecycle";
import { isAgentSetupLive } from "./setup-progress-steps";

export type NextStepModal = "protection" | "connect" | "test";

export type NextStepTone = "warn" | "info" | "success";

export interface NextStepGuidance {
  id: "actions" | "protection" | "connect" | "test" | "live";
  message: string;
  buttonLabel?: string;
  modal?: NextStepModal;
  href?: string;
  tone: NextStepTone;
}

function isConnected(
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): boolean {
  return (
    lifecycle.connectionAcknowledged ||
    lifecycle.connectionTestPassed ||
    !!key?.lastUsedAt
  );
}

export function getNextStepGuidance(
  agentId: string,
  lifecycle: AgentLifecycleProgress,
  key: AgentApiKeyRecord | null
): NextStepGuidance {
  const setupHref = `/agents/${encodeURIComponent(agentId)}/setup?wizard=2`;

  if (isAgentSetupLive(lifecycle, key)) {
    return {
      id: "live",
      message: "🎉 Agent is live and protected. All actions will be gated.",
      tone: "success",
    };
  }

  if (!lifecycle.actionsConfigured) {
    return {
      id: "actions",
      message:
        "Define which actions this agent can take before connecting it to your systems.",
      buttonLabel: "Configure actions →",
      href: setupHref,
      tone: "warn",
    };
  }

  if (!lifecycle.protectionConfigured) {
    return {
      id: "protection",
      message:
        "⚠️ Protection not yet configured. Your agent can run actions without oversight.",
      buttonLabel: "Set up protection →",
      modal: "protection",
      tone: "warn",
    };
  }

  if (!isConnected(lifecycle, key)) {
    return {
      id: "connect",
      message:
        "🔌 Agent code not connected yet. Copy your API key and add it to your code.",
      buttonLabel: "Show connection details →",
      modal: "connect",
      tone: "info",
    };
  }

  if (!lifecycle.testActionPassed) {
    return {
      id: "test",
      message:
        "✅ Setup complete! Test your agent with a sandbox action to confirm everything works.",
      buttonLabel: "Run test action →",
      modal: "test",
      tone: "info",
    };
  }

  return {
    id: "live",
    message: "🎉 Agent is live and protected. All actions will be gated.",
    tone: "success",
  };
}
