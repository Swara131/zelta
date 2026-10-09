import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailDeliveryConnected } from "@/lib/agents/delivery/settings";
import { getBuilderAgentBySlug, updateBuilderAgent } from "@/lib/agents/repository";
import { saveBuilderAgentDraft } from "@/lib/agents/save-builder-agent-draft";
import { isWebSearchConfigured } from "@/lib/agents/tools/handlers/web-search";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { seedWorkflowSafetySettings } from "./seed";
import { syncAgentSchedule } from "@/lib/agents/scheduling/sync-agent-schedule";
import {
  activeWorkflowGraph,
  beginWorkflowDraft,
  discardWorkflowDraft,
  publishWorkflowDraft,
  readWorkflowState,
  writeWorkflowState,
} from "./persistence";
import { assertWorkflowCanActivate } from "./activation";
import { snapshotWorkflowVersion } from "./versions";
import { diffWorkflowSafety } from "./safety-diff";
import { syncWorkflowToAgentConfig } from "./sync-to-agent";
import { normalizeWorkflowGraph } from "./normalize";
import type { AgentWorkflowGraph, AgentWorkflowState } from "./types";
import {
  applyValidationStatusToGraph,
  validateWorkflowGraph,
} from "./validate-workflow";

export interface WorkflowBundle {
  agentDbId: string;
  slug: string;
  name: string;
  state: AgentWorkflowState;
  graph: AgentWorkflowGraph;
  hasDraft: boolean;
}

async function loadAgentBundle(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
): Promise<WorkflowBundle | null> {
  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent || agent.userId !== params.userId) return null;

  let state = readWorkflowState(agent.safetySettings);
  if (!state) {
    const seeded = seedWorkflowSafetySettings(agent);
    state = readWorkflowState(seeded);
    if (state) {
      await updateBuilderAgent(supabase, {
        agentId: agent.id,
        userId: params.userId,
        patch: { safetySettings: seeded },
      });
    }
  }

  if (!state) {
    throw new Error("Workflow could not be created for this agent.");
  }

  const graph = activeWorkflowGraph(state);
  if (!graph) {
    throw new Error("Workflow could not be created for this agent.");
  }
  return {
    agentDbId: agent.id,
    slug: agent.slug,
    name: agent.name,
    state,
    graph,
    hasDraft: Boolean(state.draft),
  };
}

export async function getAgentWorkflow(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
): Promise<WorkflowBundle | null> {
  return loadAgentBundle(supabase, params);
}

export async function saveAgentWorkflowDraft(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    slug: string;
    graph: AgentWorkflowGraph;
    displayName?: string;
    suggestedThreshold?: number;
    destinationEmail?: string | null;
  }
): Promise<{
  bundle: WorkflowBundle;
  validation: ReturnType<typeof validateWorkflowGraph>;
  safetyDiff: ReturnType<typeof diffWorkflowSafety>;
}> {
  const bundle = await loadAgentBundle(supabase, params);
  if (!bundle) {
    throw new Error("Agent not found.");
  }

  const normalizedGraph = normalizeWorkflowGraph(params.graph);
  const configPatch = syncWorkflowToAgentConfig(normalizedGraph, {
    displayName: params.displayName ?? bundle.name,
    suggestedThreshold: params.suggestedThreshold,
    destinationEmail: params.destinationEmail,
  });

  const validation = validateWorkflowGraph(normalizedGraph, {
    emailConnected: isEmailDeliveryConnected(),
    webSearchConnected: isWebSearchConfigured(),
  });
  const graphWithStatus = applyValidationStatusToGraph(normalizedGraph, validation);

  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent) throw new Error("Agent not found.");

  const safetyDiff = diffWorkflowSafety(
    graphWithStatus,
    agent.tools,
    agent.safetySettings
  );

  let state = beginWorkflowDraft(bundle.state);
  state = {
    ...state,
    draft: graphWithStatus,
    verificationStatus: validation.valid ? "pending" : "invalid",
  };

  const updatedSafety = writeWorkflowState(agent.safetySettings, state);

  await saveBuilderAgentDraft(supabase, {
    userId: params.userId,
    userEmail: params.userEmail,
    input: {
      agentDbId: bundle.agentDbId,
      displayName: configPatch.displayName ?? bundle.name,
      goal: configPatch.goal,
      instructions: configPatch.instructions,
      scheduleSummary: configPatch.scheduleSummary,
      schedule: configPatch.schedule,
      timezone: configPatch.timezone,
      capabilityIds: configPatch.capabilityIds,
      tools: configPatch.tools,
      triggerType: configPatch.triggerType,
      suggestedThreshold: configPatch.suggestedThreshold,
      status: "draft",
      deliveryMode: configPatch.deliveryMode,
      destinationEmail: configPatch.destinationEmail,
      safetySettings: updatedSafety,
    },
  });

  const refreshed = await loadAgentBundle(supabase, params);
  if (!refreshed) throw new Error("Agent not found.");

  return { bundle: refreshed, validation, safetyDiff };
}

export async function verifyAgentWorkflow(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
) {
  const bundle = await loadAgentBundle(supabase, params);
  if (!bundle) throw new Error("Agent not found.");

  const graph = activeWorkflowGraph(bundle.state);
  if (!graph) throw new Error("Workflow not found.");

  const validation = validateWorkflowGraph(graph, {
    emailConnected: isEmailDeliveryConnected(),
    webSearchConnected: isWebSearchConfigured(),
  });

  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent) throw new Error("Agent not found.");

  const safetyDiff = diffWorkflowSafety(graph, agent.tools, agent.safetySettings);
  const graphWithStatus = applyValidationStatusToGraph(graph, validation);

  const state: AgentWorkflowState = {
    ...bundle.state,
    draft: bundle.state.draft ? graphWithStatus : bundle.state.draft,
    published: bundle.state.draft ? bundle.state.published : graphWithStatus,
    lastVerifiedAt: validation.valid ? new Date().toISOString() : bundle.state.lastVerifiedAt,
    verificationStatus: validation.valid
      ? safetyDiff.requiresSafetyReview
        ? "pending"
        : "valid"
      : "invalid",
  };

  await updateBuilderAgent(supabase, {
    agentId: bundle.agentDbId,
    userId: params.userId,
    patch: {
      safetySettings: writeWorkflowState(agent.safetySettings, state),
    },
  });

  return { validation, safetyDiff, state };
}

export async function publishAgentWorkflow(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
) {
  const verification = await verifyAgentWorkflow(supabase, params);
  if (!verification.validation.valid) {
    throw new Error("Fix workflow issues before publishing.");
  }

  const bundle = await loadAgentBundle(supabase, params);
  if (!bundle) throw new Error("Agent not found.");

  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent) throw new Error("Agent not found.");

  const graphToPublish = bundle.state.draft ?? bundle.state.published;
  assertWorkflowCanActivate({
    validation: verification.validation,
    graph: graphToPublish,
    safetyReviewedAt: bundle.state.safetyReviewedAt,
  });

  const publishedState = publishWorkflowDraft({
    ...bundle.state,
    draft: bundle.state.draft ?? bundle.state.published,
    versions: snapshotWorkflowVersion(
      graphToPublish,
      bundle.state.versions,
      "Published workflow"
    ),
  });

  await updateBuilderAgent(supabase, {
    agentId: bundle.agentDbId,
    userId: params.userId,
    patch: {
      safetySettings: writeWorkflowState(agent.safetySettings, publishedState),
      status: "active",
      publishedAt: new Date().toISOString(),
    },
  });

  if (agent.schedule?.when && agent.schedule.when !== "manual") {
    try {
      await syncAgentSchedule(supabase, {
        agentId: agent.id,
        userId: params.userId,
        organizationId: agent.organizationId,
        schedule: agent.schedule,
        timezone: agent.timezone ?? "UTC",
        agentActive: true,
      });
    } catch (err) {
      console.warn("[scheduler] schedule sync on publish skipped:", err);
    }
  }

  return { slug: params.slug, publishedAt: new Date().toISOString() };
}

export async function discardAgentWorkflowDraft(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
) {
  const bundle = await loadAgentBundle(supabase, params);
  if (!bundle) throw new Error("Agent not found.");

  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent) throw new Error("Agent not found.");

  const state = discardWorkflowDraft(bundle.state);
  await updateBuilderAgent(supabase, {
    agentId: bundle.agentDbId,
    userId: params.userId,
    patch: {
      safetySettings: writeWorkflowState(agent.safetySettings, state),
    },
  });

  return state;
}

export async function reviewAgentWorkflowSafety(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
): Promise<AgentWorkflowState> {
  const bundle = await loadAgentBundle(supabase, params);
  if (!bundle) throw new Error("Agent not found.");

  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent) throw new Error("Agent not found.");

  const state: AgentWorkflowState = {
    ...bundle.state,
    safetyReviewedAt: new Date().toISOString(),
  };

  await updateBuilderAgent(supabase, {
    agentId: bundle.agentDbId,
    userId: params.userId,
    patch: {
      safetySettings: writeWorkflowState(agent.safetySettings, state),
    },
  });

  return state;
}
