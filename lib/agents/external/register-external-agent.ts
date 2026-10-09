import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyAgentId } from "@/lib/agent-builder/slug";
import type { AgentConnectionPlatformId } from "@/lib/agents/platform/connection-options";
import {
  getBuilderAgentBySlug,
  insertBuilderAgent,
  resolveUniqueAgentSlug,
  updateBuilderAgent,
} from "@/lib/agents/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { readExternalConnection, writeExternalConnection } from "./connection-store";
import { evaluateExternalSafetyEligibility } from "./safety-eligibility";
import type { AgentSafetySettings } from "@/lib/agents/runtime-types";
import type { ExternalAgentConnection, ExternalConnectionMethod, ExternalTestResult } from "./types";

function externalSource(platform: AgentConnectionPlatformId): string {
  if (platform === "zelta") return "zelta-builder";
  return `external-${platform}`;
}

export async function registerExternalAgentConnection(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    agentName: string;
    agentSlug?: string;
    platform: AgentConnectionPlatformId;
    connectionMethod: ExternalConnectionMethod;
    endpointUrl?: string;
    authType?: "none" | "bearer" | "api_key_header";
    authHeaderName?: string;
    authConfigured: boolean;
    testResult: ExternalTestResult;
  }
): Promise<{ slug: string; connection: ExternalAgentConnection }> {
  const admin = createAdminClient();
  const baseSlug = slugifyAgentId(params.agentSlug ?? params.agentName);
  const slug = await resolveUniqueAgentSlug(admin, params.organizationId, baseSlug);
  const safety = evaluateExternalSafetyEligibility(params.connectionMethod);

  const connection: ExternalAgentConnection = {
    origin: params.platform === "zelta" ? "zelta" : "external",
    platform: params.platform,
    connectionMethod: params.connectionMethod,
    agentName: params.agentName.trim(),
    agentSlug: slug,
    endpointUrl: params.endpointUrl ?? null,
    authType: params.authType ?? "none",
    authHeaderName: params.authHeaderName ?? null,
    authConfigured: params.authConfigured,
    connectionVerifiedAt: params.testResult.passed ? new Date().toISOString() : null,
    lastTestAt: new Date().toISOString(),
    lastTestPassed: params.testResult.passed,
    lastTestChecks: params.testResult.checks,
    safetyEligible: safety.eligible,
    safetyMessage: safety.message,
    deploymentState: "idle",
    updatedAt: new Date().toISOString(),
  };

  const lookupSlug = params.agentSlug ?? slug;
  const existing = await getBuilderAgentBySlug(
    supabase,
    params.organizationId,
    lookupSlug
  ).catch(() => null);

  if (existing) {
    const mergedSettings = writeExternalConnection(existing.safetySettings, connection);
    await updateBuilderAgent(supabase, {
      agentId: existing.id,
      userId: params.userId,
      patch: {
        name: params.agentName.trim(),
        safetySettings: mergedSettings,
      },
    });
    return { slug: existing.slug, connection };
  }

  await insertBuilderAgent(admin, {
    userId: params.userId,
    organizationId: params.organizationId,
    name: params.agentName.trim(),
    slug,
    description: `External agent connected via ${params.connectionMethod.replace("_", " ")}.`,
    source: externalSource(params.platform),
    tools: ["http_request"],
    triggerType: "webhook",
    safetySettings: writeExternalConnection({}, connection),
  });

  return { slug, connection };
}

export function mergeTestIntoExistingConnection(
  safetySettings: AgentSafetySettings | undefined,
  testResult: ExternalTestResult
): ExternalAgentConnection | null {
  const existing = readExternalConnection(safetySettings);
  if (!existing) return null;

  return {
    ...existing,
    connectionVerifiedAt: testResult.passed ? new Date().toISOString() : existing.connectionVerifiedAt,
    lastTestAt: new Date().toISOString(),
    lastTestPassed: testResult.passed,
    lastTestChecks: testResult.checks,
    updatedAt: new Date().toISOString(),
  };
}
