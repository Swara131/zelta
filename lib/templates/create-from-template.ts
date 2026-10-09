import type { SupabaseClient } from "@supabase/supabase-js";
import { createBuilderAgent } from "@/lib/agents/create-builder-agent";
import { updateBuilderAgent } from "@/lib/agents/repository";
import {
  buildTemplateAgentDescription,
  resolveTemplateThreshold,
} from "./build-template-description";
import {
  buildSafetySettingsFromTemplate,
  resolveAutoAllow,
  shouldStartPaused,
} from "./clone-safety";
import { getTemplateById } from "./repository";
import type { CreateFromTemplateResult, TemplateCustomizations } from "./types";

function displayAgentName(templateName: string): string {
  const trimmed = templateName.trim();
  if (/agent$/i.test(trimmed)) return trimmed;
  return `${trimmed} Agent`;
}

function slugifyTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createAgentFromTemplate(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    templateId: string;
    customizations: TemplateCustomizations;
  }
): Promise<CreateFromTemplateResult> {
  const template = await getTemplateById(supabase, params.templateId);
  if (!template) {
    throw new Error("Template not found.");
  }

  const description = buildTemplateAgentDescription(template, params.customizations);
  const threshold = resolveTemplateThreshold(template, params.customizations);
  const agentName = slugifyTemplateName(template.name);
  const safetySettings = buildSafetySettingsFromTemplate(template, params.customizations);
  const instructions =
    [template.defaultInstructions, params.customizations.customInstructions?.trim()]
      .filter(Boolean)
      .join("\n\n") || undefined;

  const result = await createBuilderAgent(supabase, {
    userId: params.userId,
    userEmail: params.userEmail,
    input: {
      name: agentName,
      description,
      source: `template:${template.id}`,
      tools: template.tools,
      triggerType: template.triggerType,
      suggestedThreshold: threshold,
      autoAllow: resolveAutoAllow(template, params.customizations),
      instructions,
      goal: template.shortDescription ?? template.summary,
      safetySettings,
    },
  });

  if (shouldStartPaused(template)) {
    await updateBuilderAgent(supabase, {
      agentId: result.agent.id,
      userId: params.userId,
      patch: { status: "draft" },
    });
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[template-clone]", {
      templateSlug: template.slug ?? template.id,
      createdAgentId: result.agent.slug,
      workspaceId: result.agent.organizationId,
      route: `/agents/${result.agent.slug}/setup?from=template`,
    });
  }

  return {
    agentId: result.agent.slug,
    apiKey: result.apiKey.plainKey,
    keyPrefix: result.apiKey.key.keyPrefix,
    name: displayAgentName(template.name),
    description,
    tools: template.tools,
    triggerType: template.triggerType,
    suggestedThreshold: threshold,
    templateId: template.id,
    templateName: template.name,
    riskLevel: template.riskLevel,
    spec: {
      name: result.spec.name,
      description: result.spec.purpose || result.spec.summary || description,
      tools: result.spec.tools.map((tool) => ({ toolName: tool.toolName })),
      triggerType: template.triggerType,
    },
  };
}
