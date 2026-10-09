import type { SupabaseClient } from "@supabase/supabase-js";
import { getBuilderAgentBySlug, updateBuilderAgent } from "@/lib/agents/repository";
import { recordAudit } from "@/lib/audit/logger";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import { parseTemplateFromAgentSource } from "@/lib/templates/parse-template-source";
import type { AgentTemplate } from "@/lib/templates/types";
import { buildDefaultScenario } from "./default-scenario";
import { getDemoScenario } from "./registry";
import {
  applyPolicyDecision,
  assertPendingMatches,
  completeSimulation,
  createEvaluatingRun,
  rejectSimulation,
  resolveAction,
} from "./evaluate";
import { hashSimulationInputs } from "./hash";
import { readSimulationRun, writeSimulationRun } from "./persist";
import type { DemoScenario, SimulationRun } from "./types";

export class SimulationAuthError extends Error {
  constructor(message = "Agent not found.") {
    super(message);
    this.name = "SimulationAuthError";
  }
}

async function loadOwnedAgent(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
) {
  const organizationId = await ensureOrganization(
    supabase,
    params.userId,
    params.userEmail
  );
  const agent = await getBuilderAgentBySlug(supabase, organizationId, params.slug);
  if (!agent || agent.userId !== params.userId || agent.organizationId !== organizationId) {
    throw new SimulationAuthError();
  }
  return { agent, organizationId };
}

function resolveScenario(agent: {
  slug: string;
  name: string;
  description: string;
  source: string;
  tools: string[];
  safetySettings: { template?: { slug?: string; id?: string; name?: string } };
}): { templateSlug: string; scenario: DemoScenario } {
  const fromSafety = agent.safetySettings.template?.slug ?? agent.safetySettings.template?.id;
  const parsed = parseTemplateFromAgentSource(agent.source);
  const templateSlug = fromSafety ?? parsed?.templateSlug ?? agent.slug;
  const fromRegistry = getDemoScenario(templateSlug);
  if (fromRegistry) return { templateSlug, scenario: fromRegistry };

  return {
    templateSlug,
    scenario: buildDefaultScenario({
      id: templateSlug,
      slug: templateSlug,
      name: agent.safetySettings.template?.name ?? agent.name,
      description: agent.description,
      summary: agent.description,
      shortDescription: agent.description,
      icon: "bot",
      category: "operations-productivity",
      defaultDescription: agent.description,
      tools: agent.tools as AgentTemplate["tools"],
      triggerType: "webhook",
      supportsThreshold: false,
      defaultThreshold: null,
      exampleTasks: [agent.description],
    }),
  };
}

export async function getAgentSimulationContext(
  supabase: SupabaseClient,
  params: { userId: string; userEmail: string; slug: string }
): Promise<{
  scenario: DemoScenario;
  lastRun: SimulationRun | null;
  workspaceId: string;
  agentId: string;
  templateSlug: string;
}> {
  const { agent, organizationId } = await loadOwnedAgent(supabase, params);
  const { templateSlug, scenario } = resolveScenario(agent);
  return {
    scenario,
    lastRun: readSimulationRun(agent.safetySettings),
    workspaceId: organizationId,
    agentId: agent.slug,
    templateSlug,
  };
}

export async function startSimulationRun(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    slug: string;
    actionId: string;
    inputs: Record<string, string>;
  }
): Promise<SimulationRun> {
  const { agent, organizationId } = await loadOwnedAgent(supabase, params);
  const { templateSlug, scenario } = resolveScenario(agent);
  const action = resolveAction(scenario, params.actionId);
  if (!action) throw new Error("Unknown simulation action.");

  const existing = readSimulationRun(agent.safetySettings);
  const inputHash = hashSimulationInputs(action.id, params.inputs);
  if (
    existing?.status === "approval_required" &&
    existing.pending &&
    existing.inputHash === inputHash &&
    existing.actionId === action.id &&
    Date.parse(existing.pending.expiresAt) > Date.now()
  ) {
    return existing;
  }

  const run = applyPolicyDecision({
    run: createEvaluatingRun({
      runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      correlationId: `corr-${Date.now().toString(36)}`,
      agentId: agent.slug,
      workspaceId: organizationId,
      userId: params.userId,
      scenario,
      action,
      inputs: params.inputs,
    }),
    scenario,
    action,
    userId: params.userId,
  });

  await updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId: params.userId,
    patch: { safetySettings: writeSimulationRun(agent.safetySettings, run) },
  });

  await recordAudit(supabase, {
    userId: params.userId,
    organizationId,
    action: "analyze",
    entityType: "simulation_run",
    entityId: run.id,
    metadata: {
      templateSlug,
      status: run.status,
      correlationId: run.correlationId,
      mode: "simulation",
    },
  });

  return run;
}

export async function decideSimulationRun(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    slug: string;
    runId: string;
    decision: "approve" | "reject";
  }
): Promise<SimulationRun> {
  const { agent, organizationId } = await loadOwnedAgent(supabase, params);
  const lastRun = readSimulationRun(agent.safetySettings);
  if (!lastRun || lastRun.id !== params.runId) {
    throw new Error("Simulation run not found.");
  }
  if (lastRun.status !== "approval_required" || !lastRun.pending) {
    throw new Error("This run is not waiting for approval.");
  }

  assertPendingMatches({
    pending: lastRun.pending,
    userId: params.userId,
    workspaceId: organizationId,
    agentId: agent.slug,
    actionId: lastRun.actionId,
    inputHash: lastRun.inputHash,
  });

  const { templateSlug, scenario } = resolveScenario(agent);
  const action = resolveAction(scenario, lastRun.actionId);
  if (!action) throw new Error("Unknown simulation action.");

  const next =
    params.decision === "reject"
      ? rejectSimulation(lastRun)
      : completeSimulation(
          { ...lastRun, status: "executing_simulation" },
          scenario,
          action
        );

  await updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId: params.userId,
    patch: { safetySettings: writeSimulationRun(agent.safetySettings, next) },
  });

  await recordAudit(supabase, {
    userId: params.userId,
    organizationId,
    action: params.decision === "approve" ? "approve" : "reject",
    entityType: "simulation_run",
    entityId: next.id,
    metadata: {
      templateSlug,
      status: next.status,
      correlationId: next.correlationId,
      mode: "simulation",
    },
  });

  return next;
}
