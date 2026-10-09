import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyAgentId } from "@/lib/agent-builder/slug";
import { createBuilderAgent } from "./create-builder-agent";
import {
  getBuilderAgentById,
  getBuilderAgentBySlug,
  updateBuilderAgent,
} from "./repository";
import { syncAgentSchedule } from "./scheduling/sync-agent-schedule";
import { getAgentScheduleByAgentId } from "./runtime-repository";
import type { AgentInterpretation } from "./builder-types";
import type { AgentScheduleConfig, AgentSafetySettings } from "./runtime-types";
import {
  capabilityIdsToTools,
  capabilityToEntries,
  inferCapabilityIdsFromText,
  inferCapabilityIdsFromTools,
  type BuilderCapabilityId,
} from "./builder-capabilities";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { inferDeliveryModeFromText } from "./delivery/infer-delivery";
import type { AgentDeliveryMode } from "./delivery/types";
import { mergeDeliverySettings } from "./delivery/settings";
import { assertTemplateAgentCanActivate } from "@/lib/templates/activation";

export interface SaveBuilderDraftInput {
  agentDbId?: string;
  displayName: string;
  goal: string;
  instructions: string;
  scheduleSummary: string;
  schedule: AgentScheduleConfig;
  timezone: string;
  capabilityIds: BuilderCapabilityId[];
  tools?: string[];
  triggerType: "email" | "webhook" | "schedule";
  suggestedThreshold: number;
  originalDescription?: string;
  status?: "draft" | "testing" | "active";
  deliveryMode?: AgentDeliveryMode;
  destinationEmail?: string | null;
  safetySettings?: AgentSafetySettings;
}

export interface SaveBuilderDraftResult {
  agentDbId: string;
  slug: string;
  apiKey?: string;
  keyPrefix?: string;
}

function defaultSafetySettings(
  threshold: number,
  delivery?: { mode: AgentDeliveryMode; destinationEmail?: string | null }
): AgentSafetySettings {
  const base: AgentSafetySettings = {
    requireApprovalFor: [
      "issue_refund",
      "update_crm_record",
      "delete_crm_record",
      "send_whatsapp_message",
    ],
    thresholdInr: threshold,
    autoAllowBelowThreshold: true,
  };

  if (delivery) {
    return mergeDeliverySettings(base, {
      mode: delivery.mode,
      destinationEmail: delivery.destinationEmail ?? null,
    });
  }

  return base;
}

function mergeSaveCapabilities(input: SaveBuilderDraftInput): {
  capabilityIds: BuilderCapabilityId[];
  tools: string[];
  capabilities: ReturnType<typeof capabilityToEntries>;
} {
  const fromGoal = inferCapabilityIdsFromText(
    [input.goal, input.originalDescription, input.instructions].filter(Boolean).join(" ")
  );
  const fromInput = input.capabilityIds ?? [];
  const fromTools = inferCapabilityIdsFromTools(input.tools ?? []);
  const capabilityIds = [
    ...new Set([...fromInput, ...fromGoal, ...fromTools]),
  ] as BuilderCapabilityId[];
  const tools = [
    ...new Set([
      ...capabilityIdsToTools(capabilityIds),
      ...(input.tools ?? []),
    ]),
  ];

  return {
    capabilityIds,
    tools,
    capabilities: capabilityToEntries(capabilityIds),
  };
}

export async function saveBuilderAgentDraft(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    input: SaveBuilderDraftInput;
  }
): Promise<SaveBuilderDraftResult> {
  const merged = mergeSaveCapabilities(params.input);
  const { tools, capabilities } = merged;

  if (tools.length === 0) {
    throw new Error("Select at least one capability for your agent.");
  }

  const inferredDeliveryMode =
    params.input.deliveryMode ??
    inferDeliveryModeFromText(
      [params.input.goal, params.input.originalDescription, params.input.instructions]
        .filter(Boolean)
        .join(" ")
    );

  const baseSafetySettings = defaultSafetySettings(params.input.suggestedThreshold, {
    mode: inferredDeliveryMode,
    destinationEmail: params.input.destinationEmail ?? null,
  });
  const saveStatus = params.input.status ?? "active";

  if (params.input.agentDbId) {
    const existing = await getBuilderAgentById(supabase, {
      agentId: params.input.agentDbId,
      userId: params.userId,
    });

    if (!existing) {
      throw new Error("Agent not found.");
    }

    const safetySettings: AgentSafetySettings = {
      ...baseSafetySettings,
      ...existing.safetySettings,
      ...params.input.safetySettings,
      delivery: params.input.safetySettings?.delivery ?? baseSafetySettings.delivery,
    };

    const agent = await updateBuilderAgent(supabase, {
      agentId: existing.id,
      userId: params.userId,
      patch: {
        name: params.input.displayName.trim(),
        description: params.input.goal.trim(),
        goal: params.input.goal.trim(),
        instructions: params.input.instructions.trim(),
        tools,
        capabilities,
        triggerType: params.input.triggerType,
        schedule: params.input.schedule,
        timezone: params.input.timezone,
        safetySettings,
        suggestedThreshold: params.input.suggestedThreshold,
        status: saveStatus,
      },
    });

    try {
      await syncAgentSchedule(supabase, {
        agentId: agent.id,
        userId: params.userId,
        organizationId: agent.organizationId,
        schedule: params.input.schedule,
        scheduleSummary: params.input.scheduleSummary,
        timezone: params.input.timezone,
      });
    } catch (scheduleErr) {
      console.warn("Agent schedule upsert skipped:", scheduleErr);
    }

    return {
      agentDbId: agent.id,
      slug: agent.slug,
    };
  }

  const safetySettings: AgentSafetySettings = {
    ...baseSafetySettings,
    ...params.input.safetySettings,
  };

  const result = await createBuilderAgent(supabase, {
    userId: params.userId,
    userEmail: params.userEmail,
    input: {
      name: slugifyAgentId(params.input.displayName),
      description: params.input.goal.trim(),
      source: "zelta-builder",
      tools,
      triggerType: params.input.triggerType,
      suggestedThreshold: params.input.suggestedThreshold,
      goal: params.input.goal.trim(),
      instructions: params.input.instructions.trim(),
      capabilities,
      schedule: params.input.schedule,
      timezone: params.input.timezone,
      safetySettings,
    },
  });

  await updateBuilderAgent(supabase, {
    agentId: result.agent.id,
    userId: params.userId,
    patch: {
      name: params.input.displayName.trim(),
      status: saveStatus,
    },
  });

  try {
    await syncAgentSchedule(supabase, {
      agentId: result.agent.id,
      userId: params.userId,
      organizationId: result.agent.organizationId,
      schedule: params.input.schedule,
      scheduleSummary: params.input.scheduleSummary,
      timezone: params.input.timezone,
    });
  } catch (scheduleErr) {
    console.warn("Agent schedule upsert skipped:", scheduleErr);
  }

  return {
    agentDbId: result.agent.id,
    slug: result.agent.slug,
    apiKey: result.apiKey.plainKey,
    keyPrefix: result.apiKey.key.keyPrefix,
  };
}

export async function publishBuilderAgent(
  supabase: SupabaseClient,
  params: { userId: string; agentDbId: string }
): Promise<{ slug: string; publishedAt: string }> {
  const publishedAt = new Date().toISOString();

  const existing = await getBuilderAgentById(supabase, {
    agentId: params.agentDbId,
    userId: params.userId,
  });

  if (!existing) {
    throw new Error("Agent not found.");
  }

  assertTemplateAgentCanActivate(existing);

  const agent = await updateBuilderAgent(supabase, {
    agentId: params.agentDbId,
    userId: params.userId,
    patch: {
      status: "active",
      publishedAt,
    },
  });

  try {
    const schedule = await getAgentScheduleByAgentId(supabase, {
      agentId: agent.id,
      userId: params.userId,
    });
    const configMeta = schedule?.scheduleConfig as Record<string, unknown> | undefined;
    const scheduleSummary =
      typeof configMeta?.summary === "string" ? configMeta.summary : undefined;

    await syncAgentSchedule(supabase, {
      agentId: agent.id,
      userId: params.userId,
      organizationId: agent.organizationId,
      schedule: agent.schedule,
      scheduleSummary,
      timezone: agent.timezone,
    });
  } catch (scheduleErr) {
    console.warn("Agent schedule upsert skipped:", scheduleErr);
  }

  return {
    slug: agent.slug,
    publishedAt,
  };
}

export function interpretationToDraftInput(
  interpretation: AgentInterpretation,
  agentDbId?: string
): SaveBuilderDraftInput {
  return {
    agentDbId,
    displayName: interpretation.displayName,
    goal: interpretation.goal,
    instructions: interpretation.instructions,
    scheduleSummary: interpretation.scheduleSummary,
    schedule: interpretation.schedule,
    timezone: interpretation.timezone,
    capabilityIds: interpretation.capabilityIds,
    tools: interpretation.tools,
    triggerType: interpretation.triggerType,
    suggestedThreshold: interpretation.suggestedThreshold,
    originalDescription: interpretation.originalDescription,
    status: "draft",
    deliveryMode: interpretation.deliveryMode,
  };
}

export async function getBuilderAgentForUserBySlug(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
) {
  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );

  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent || agent.userId !== params.userId) {
    return null;
  }

  return agent;
}
