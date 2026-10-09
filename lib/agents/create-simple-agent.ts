import type { SupabaseClient } from "@supabase/supabase-js";
import { createBuilderAgent } from "./create-builder-agent";
import { interpretAgentRequest } from "./interpret-agent-request";

export interface CreateSimpleAgentResult {
  agentId: string;
  apiKey: string;
  keyPrefix: string;
  name: string;
  description: string;
  tools: string[];
  triggerType: string;
  suggestedThreshold: number;
  spec: Awaited<ReturnType<typeof createBuilderAgent>>["spec"];
}

function displayAgentName(specName: string): string {
  const trimmed = specName.trim();
  if (/agent$/i.test(trimmed)) return trimmed;
  return `${trimmed} Agent`;
}

export async function createSimpleAgent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    description: string;
  }
): Promise<CreateSimpleAgentResult> {
  const parsed = await interpretAgentRequest(params.description, {
    minLength: 15,
  });
  const threshold = parsed.suggestedThreshold ?? 5_000;

  const result = await createBuilderAgent(supabase, {
    userId: params.userId,
    userEmail: params.userEmail,
    input: {
      name: parsed.displayName,
      description: parsed.originalDescription || parsed.goal,
      source: "zelta-builder",
      tools: parsed.tools,
      triggerType: parsed.triggerType,
      suggestedThreshold: threshold,
      goal: parsed.goal,
      instructions: parsed.instructions,
      capabilities: parsed.capabilities,
      schedule: parsed.schedule,
      timezone: parsed.timezone,
      safetySettings: {
        delivery: {
          mode: parsed.deliveryMode,
          destinationEmail: null,
          destinationPhone: null,
        },
      },
    },
  });

  return {
    agentId: result.agent.slug,
    apiKey: result.apiKey.plainKey,
    keyPrefix: result.apiKey.key.keyPrefix,
    name: displayAgentName(result.spec.name),
    description: parsed.goal,
    tools: parsed.tools,
    triggerType: parsed.triggerType,
    suggestedThreshold: threshold,
    spec: result.spec,
  };
}
