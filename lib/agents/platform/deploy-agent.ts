import type { SupabaseClient } from "@supabase/supabase-js";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { publishAgentWorkflow } from "@/lib/agents/workflow/service";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { readPlatformLifecycle, writePlatformLifecycle } from "./lifecycle-store";
import type { AgentDeploymentRecord, AgentPlatformLifecycle } from "./lifecycle-types";
import { isAgentReadyToDeploy } from "./verify-agent";
import { assertBuilderAgentRequirementsReady } from "@/lib/agents/requirements/assert-ready";

export interface DeployProgressStep {
  id: AgentDeploymentRecord["state"];
  label: string;
  done: boolean;
  current: boolean;
}

const DEPLOY_STEPS: Array<{ id: AgentDeploymentRecord["state"]; label: string }> = [
  { id: "preparing", label: "Preparing agent" },
  { id: "validating", label: "Validating configuration" },
  { id: "publishing", label: "Publishing" },
  { id: "starting_runtime", label: "Starting runtime" },
  { id: "health_check", label: "Health check" },
  { id: "deployed", label: "Deployed" },
];

export function buildDeployProgress(state: AgentDeploymentRecord["state"]): DeployProgressStep[] {
  const order = DEPLOY_STEPS.map((step) => step.id);
  const currentIndex = order.indexOf(state);
  return DEPLOY_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    done: currentIndex > index || state === "deployed",
    current: order[index] === state,
  }));
}

export async function deployAgentPlatform(
  supabase: SupabaseClient,
  params: {
    agent: BuilderAgentRecord;
    userId: string;
    userEmail: string;
  }
): Promise<{ lifecycle: AgentPlatformLifecycle; slug: string }> {
  const lifecycle = readPlatformLifecycle(params.agent.safetySettings);

  if (!isAgentReadyToDeploy(lifecycle)) {
    throw new Error("Agent is not ready for deployment. Run verification and fix issues first.");
  }

  assertBuilderAgentRequirementsReady(params.agent, "deploy");

  const nextVersion = (lifecycle.deployment.version || 0) + 1;
  let deployment: AgentDeploymentRecord = {
    ...lifecycle.deployment,
    version: nextVersion,
    previousVersion: lifecycle.deployment.version || null,
    state: "preparing",
    errorMessage: null,
  };

  const persistStage = async (state: AgentDeploymentRecord["state"]) => {
    deployment = { ...deployment, state };
    const staged: AgentPlatformLifecycle = {
      ...lifecycle,
      stage: "deploying",
      deployment,
      updatedAt: new Date().toISOString(),
    };
    await updateBuilderAgent(supabase, {
      agentId: params.agent.id,
      userId: params.userId,
      patch: {
        safetySettings: writePlatformLifecycle(params.agent.safetySettings, staged),
      },
    });
  };

  await persistStage("preparing");
  await persistStage("validating");

  await persistStage("publishing");
  const published = await publishAgentWorkflow(supabase, {
    userId: params.userId,
    userEmail: params.userEmail,
    slug: params.agent.slug,
  });

  await persistStage("starting_runtime");
  await persistStage("health_check");

  deployment = {
    ...deployment,
    state: "deployed",
    deployedAt: published.publishedAt,
    hasUnpublishedDraft: false,
    draftVersion: null,
  };

  const finalLifecycle: AgentPlatformLifecycle = {
    ...lifecycle,
    stage: "deployed",
    deployment,
    updatedAt: new Date().toISOString(),
  };

  await updateBuilderAgent(supabase, {
    agentId: params.agent.id,
    userId: params.userId,
    patch: {
      status: "active",
      publishedAt: published.publishedAt,
      safetySettings: writePlatformLifecycle(params.agent.safetySettings, finalLifecycle),
    },
  });

  return { lifecycle: finalLifecycle, slug: params.agent.slug };
}
