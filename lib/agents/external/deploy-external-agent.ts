import type { SupabaseClient } from "@supabase/supabase-js";
import { deployAgentPlatform } from "@/lib/agents/platform/deploy-agent";
import { isAgentReadyToDeploy } from "@/lib/agents/platform/verify-agent";
import { readPlatformLifecycle, writePlatformLifecycle } from "@/lib/agents/platform/lifecycle-store";
import { createDefaultPlatformLifecycle } from "@/lib/agents/platform/lifecycle-types";
import { getBuilderAgentBySlug, updateBuilderAgent } from "@/lib/agents/repository";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import { readExternalConnection, writeExternalConnection } from "./connection-store";

export interface ExternalDeployIssue {
  id: string;
  message: string;
}

export interface ExternalDeployResult {
  ready: boolean;
  issues: ExternalDeployIssue[];
  slug?: string;
  deployedAt?: string | null;
}

export async function deployExternalAgent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    slug: string;
    environment?: "production";
  }
): Promise<ExternalDeployResult> {
  const { data: agentRow } = await supabase
    .from("agents")
    .select("*")
    .eq("slug", params.slug)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!agentRow) {
    return {
      ready: false,
      issues: [{ id: "agent", message: "Agent not found." }],
    };
  }

  const agent = await getBuilderAgentBySlug(
    supabase,
    agentRow.organization_id as string,
    params.slug
  );
  if (!agent) {
    return {
      ready: false,
      issues: [{ id: "agent", message: "Agent not found." }],
    };
  }

  const connection = readExternalConnection(agent.safetySettings);
  const issues: ExternalDeployIssue[] = [];

  if (!connection) {
    issues.push({ id: "connection", message: "No connection record found for this agent." });
    return { ready: false, issues };
  }

  if (!connection.connectionVerifiedAt || !connection.lastTestPassed) {
    issues.push({ id: "connection", message: "Connection has not been verified. Run Test Connection first." });
  }

  if (connection.origin === "external" && !connection.safetyEligible) {
    issues.push({
      id: "safety",
      message:
        connection.safetyMessage ??
        "Safety controls unavailable for this connection type.",
    });
  }

  if (issues.length > 0) {
    const updatedConnection = {
      ...connection,
      deploymentState: "needs_attention" as const,
      updatedAt: new Date().toISOString(),
    };
    await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: params.userId,
      patch: {
        safetySettings: writeExternalConnection(agent.safetySettings, updatedConnection),
      },
    });
    return { ready: false, issues };
  }

  if (connection.origin === "zelta" || agent.source === "zelta-builder") {
    const lifecycle = readPlatformLifecycle(agent.safetySettings) ?? createDefaultPlatformLifecycle();
    if (!isAgentReadyToDeploy({ ...lifecycle, stage: lifecycle.stage })) {
      issues.push({
        id: "verification",
        message: "Wave agent is not verified yet. Complete Test and Verify first.",
      });
      return { ready: false, issues };
    }

    const deployed = await deployAgentPlatform(supabase, {
      agent,
      userId: params.userId,
      userEmail: params.userEmail,
    });

    return {
      ready: true,
      issues: [],
      slug: deployed.slug,
      deployedAt: deployed.lifecycle.deployment.deployedAt ?? new Date().toISOString(),
    };
  }

  return deployExternalGatewayAgent(supabase, agent, params.userId);
}

async function deployExternalGatewayAgent(
  supabase: SupabaseClient,
  agent: BuilderAgentRecord,
  userId: string
): Promise<ExternalDeployResult> {
  const connection = readExternalConnection(agent.safetySettings);
  if (!connection) {
    return {
      ready: false,
      issues: [{ id: "connection", message: "Connection record missing." }],
    };
  }

  const deployedAt = new Date().toISOString();
  const updatedConnection = {
    ...connection,
    deployedAt,
    deploymentState: "deployed" as const,
    updatedAt: deployedAt,
  };

  const lifecycle = readPlatformLifecycle(agent.safetySettings) ?? createDefaultPlatformLifecycle();
  const nextLifecycle = {
    ...lifecycle,
    stage: "deployed" as const,
    deployment: {
      ...lifecycle.deployment,
      state: "deployed" as const,
      deployedAt,
      version: (lifecycle.deployment.version || 0) + 1,
    },
    updatedAt: deployedAt,
  };

  await updateBuilderAgent(supabase, {
    agentId: agent.id,
    userId,
    patch: {
      status: "active",
      safetySettings: writePlatformLifecycle(
        writeExternalConnection(agent.safetySettings, updatedConnection),
        nextLifecycle
      ),
    },
  });

  return {
    ready: true,
    issues: [],
    slug: agent.slug,
    deployedAt,
  };
}
