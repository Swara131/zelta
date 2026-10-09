import type { SupabaseClient } from "@supabase/supabase-js";
import { getAgentRequirements } from "@/lib/agents/requirements/engine";
import { snapshotFromBuilderAgent } from "@/lib/agents/requirements/from-agent";
import { RequirementsNotReadyError } from "@/lib/agents/requirements/errors";
import { updateBuilderAgent } from "@/lib/agents/repository";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import type { AgentRequirement } from "@/lib/agents/requirements/types";

export async function applyChatAnswerIfPending(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  userId: string,
  message: string
): Promise<BuilderAgentRecord> {
  const pending = agent.safetySettings.pendingRequirementKey;
  if (!pending || !message.trim()) return agent;

  const setupAnswers = {
    ...(agent.safetySettings.setupAnswers ?? {}),
    [pending]: message.trim(),
  };
  const delivery = agent.safetySettings.delivery ?? {
    mode: "notification" as const,
    destinationEmail: null,
    destinationPhone: null,
  };
  if (pending === "email") {
    delivery.destinationEmail = message.trim();
    delivery.mode = delivery.mode === "notification" ? "email" : delivery.mode;
  }
  if (pending === "whatsapp") {
    delivery.destinationPhone = message.trim();
    delivery.mode = delivery.mode === "notification" ? "whatsapp" : delivery.mode;
  }

  await updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId,
    patch: {
      safetySettings: {
        ...agent.safetySettings,
        setupAnswers,
        delivery,
        pendingRequirementKey: null,
      },
    },
  });

  return {
    ...agent,
    safetySettings: {
      ...agent.safetySettings,
      setupAnswers,
      delivery,
      pendingRequirementKey: null,
    },
  };
}

export async function gateOrAskForRequirements(params: {
  supabase: SupabaseClient;
  agent: BuilderAgentRecord;
  userId: string;
  mode: "manual" | "test" | "scheduled" | "live";
}): Promise<{ agent: BuilderAgentRecord; question?: AgentRequirement }> {
  const snapshot = snapshotFromBuilderAgent(params.agent, {
    stage:
      params.mode === "test" ? "test" : params.mode === "manual" ? "setup" : "deploy",
  });
  const result = getAgentRequirements(snapshot);

  if (result.ready) {
    if (params.agent.safetySettings.pendingRequirementKey) {
      await updateBuilderAgent(params.supabase, {
        agentId: params.agent.id,
        userId: params.userId,
        patch: {
          safetySettings: {
            ...params.agent.safetySettings,
            pendingRequirementKey: null,
          },
        },
      });
    }
    return { agent: params.agent };
  }

  if (params.mode === "test" || params.mode === "scheduled" || params.mode === "live") {
    throw new RequirementsNotReadyError(result.missing);
  }

  const question = result.missing[0];
  if (question) {
    await updateBuilderAgent(params.supabase, {
      agentId: params.agent.id,
      userId: params.userId,
      patch: {
        safetySettings: {
          ...params.agent.safetySettings,
          pendingRequirementKey: question.key,
          requirementManifest: {
            generatedAt: new Date().toISOString(),
            keys: result.requirements.filter((item) => item.required).map((item) => item.key),
          },
        },
      },
    });
  }

  return { agent: params.agent, question };
}
