import { NextResponse } from "next/server";
import { resolveAgentDbDisplayStatus } from "@/lib/agents/agent-mode";
import {
  agentRequiresWebSearch,
  capabilityToEntries,
  resolveCapabilityIdsForAgent,
  resolveAgentToolsForAgent,
} from "@/lib/agents/builder-capabilities";
import {
  getAgentPolicyByAgentId,
  getBuilderAgentBySlug,
  updateBuilderAgent,
} from "@/lib/agents/repository";
import { formatNextRunAt } from "@/lib/agents/scheduling/format-next-run";
import { getAgentScheduleByAgentId } from "@/lib/agents/runtime-repository";
import {
  isEmailDeliveryConnected,
  isWhatsAppDeliveryConnected,
  parseDeliverySettings,
} from "@/lib/agents/delivery/settings";
import {
  isWhatsAppContentTemplateConfigured,
  requiresWhatsAppContentTemplate,
} from "@/lib/whatsapp/env";
import { maskPhoneDisplay } from "@/lib/whatsapp/phone";
import { getResendConfigStatus } from "@/lib/email/resend-config";
import { deliveryModeLabel, inferDeliveryModeFromText } from "@/lib/agents/delivery/infer-delivery";
import { mergeDeliverySettings } from "@/lib/agents/delivery/settings";
import { isWebSearchConfigured } from "@/lib/agents/tools/handlers/web-search";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { secureError, secureJson } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

import { dispatchAgentCollectionRoute } from "./dispatch-collection";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

function sortedTools(tools: string[]): string[] {
  return [...tools].map((tool) => tool.trim().toLowerCase()).sort();
}

export async function GET(request: Request, context: RouteContext) {
  const { agentId: slug } = await context.params;
  const collection = await dispatchAgentCollectionRoute(slug?.trim() ?? "", request);
  if (collection) return collection;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureError("Agent ID is required.", 400);
  }

  try {
    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    let agent = await getBuilderAgentBySlug(supabase, organizationId, normalizedSlug);
    if (!agent) {
      return secureJson({ error: "Agent not found." }, { status: 404 });
    }

    if (agent.userId !== user.id) {
      return secureJson({ error: "Agent not found." }, { status: 404 });
    }

    const resolvedCapabilityIds = resolveCapabilityIdsForAgent({
      tools: agent.tools,
      capabilities: agent.capabilities,
      goal: agent.goal,
      description: agent.description,
      instructions: agent.instructions,
    });
    const resolvedTools = resolveAgentToolsForAgent({
      tools: agent.tools,
      capabilities: agent.capabilities,
      goal: agent.goal,
      description: agent.description,
      instructions: agent.instructions,
    });
    const resolvedCapabilities = capabilityToEntries(resolvedCapabilityIds);

    const storedTools = sortedTools(agent.tools);
    const mergedTools = sortedTools(resolvedTools);
    const toolsDiffer =
      storedTools.length !== mergedTools.length ||
      storedTools.some((tool, index) => tool !== mergedTools[index]);

    if (toolsDiffer) {
      try {
        agent = await updateBuilderAgent(supabase, {
          agentId: agent.id,
          userId: user.id,
          patch: {
            tools: resolvedTools,
            capabilities: resolvedCapabilities,
          },
        });
      } catch (repairErr) {
        console.warn("Agent capability repair skipped:", repairErr);
      }
    }

    const requiresWebSearch = agentRequiresWebSearch({
      tools: agent.tools,
      capabilities: agent.capabilities,
      goal: agent.goal,
      description: agent.description,
      instructions: agent.instructions,
    });

    let scheduleSummary: string | null = null;
    let nextRunAt: string | null = null;
    let nextRunAtLabel: string | null = null;
    try {
      const schedule = await getAgentScheduleByAgentId(supabase, {
        agentId: agent.id,
        userId: user.id,
      });
      const configMeta = schedule?.scheduleConfig as Record<string, unknown> | undefined;
      if (typeof configMeta?.summary === "string") {
        scheduleSummary = configMeta.summary;
      }
      nextRunAt = schedule?.nextRunAt ?? null;
      if (nextRunAt) {
        nextRunAtLabel = formatNextRunAt(nextRunAt, agent.timezone);
        if (nextRunAtLabel) {
          scheduleSummary = scheduleSummary
            ? `${scheduleSummary} · Next run: ${nextRunAtLabel}`
            : `Next run: ${nextRunAtLabel}`;
        }
      }
    } catch {
      scheduleSummary = null;
    }

    if (!agent.safetySettings.delivery) {
      const inferredDelivery = inferDeliveryModeFromText(
        [agent.goal, agent.description, agent.instructions].filter(Boolean).join(" ")
      );
      try {
        agent = await updateBuilderAgent(supabase, {
          agentId: agent.id,
          userId: user.id,
          patch: {
            safetySettings: mergeDeliverySettings(agent.safetySettings, {
              mode: inferredDelivery,
              destinationEmail:
                inferredDelivery === "email" || inferredDelivery === "both"
                  ? user.email ?? null
                  : null,
            }),
          },
        });
      } catch (repairErr) {
        console.warn("Agent delivery repair skipped:", repairErr);
      }
    }

    const deliverySettings = parseDeliverySettings(agent.safetySettings);
    const policy = await getAgentPolicyByAgentId(supabase, agent.id);

    return secureJson({
      agent: {
        id: agent.id,
        slug: agent.slug,
        name: agent.name,
        description: agent.description,
        goal: agent.goal,
        instructions: agent.instructions,
        source: agent.source,
        tools: agent.tools,
        capabilities: resolvedCapabilities,
        capabilityLabels: resolvedCapabilities.map((item) => item.label),
        schedule: agent.schedule,
        scheduleSummary,
        nextRunAt,
        nextRunAtLabel,
        timezone: agent.timezone,
        triggerType: agent.triggerType,
        suggestedThreshold: agent.suggestedThreshold,
        status: agent.status,
        displayStatus: resolveAgentDbDisplayStatus(agent.status),
        requiresWebSearch,
        webSearchConnected: isWebSearchConfigured(),
        delivery: deliverySettings,
        deliveryLabel: deliveryModeLabel(deliverySettings.mode),
        destinationPhoneMasked: deliverySettings.destinationPhone
          ? maskPhoneDisplay(deliverySettings.destinationPhone)
          : null,
        emailDeliveryConnected: isEmailDeliveryConnected(),
        whatsappDeliveryConnected: isWhatsAppDeliveryConnected(),
        whatsappContentTemplateRequired: requiresWhatsAppContentTemplate(),
        whatsappContentTemplateConfigured: isWhatsAppContentTemplateConfigured(),
        emailDeliverySandbox: getResendConfigStatus().sandboxMode,
        emailDeliverySandboxRecipient:
          getResendConfigStatus().sandboxRecipient ?? user.email ?? null,
        userEmail: user.email ?? null,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
      policy: policy
        ? {
            threshold: policy.threshold,
            autoAllow: policy.autoAllow,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { agentId: slug } = await context.params;
  const collection = await dispatchAgentCollectionRoute(slug?.trim() ?? "", request);
  if (collection) return collection;
  return secureJson({ error: "Method not allowed." }, { status: 405 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { agentId: slug } = await context.params;
  const collection = await dispatchAgentCollectionRoute(slug?.trim() ?? "", request);
  if (collection) return collection;
  return secureJson({ error: "Method not allowed." }, { status: 405 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { agentId: slug } = await context.params;
  const collection = await dispatchAgentCollectionRoute(slug?.trim() ?? "", request);
  if (collection) return collection;
  return secureJson({ error: "Method not allowed." }, { status: 405 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { agentId: slug } = await context.params;
  const collection = await dispatchAgentCollectionRoute(slug?.trim() ?? "", request);
  if (collection) return collection;
  return secureJson({ error: "Method not allowed." }, { status: 405 });
}
