import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyAgentId } from "@/lib/agent-builder/slug";
import { parseDecisionAgentConfigOrDefault } from "./parse-config";
import type { DecisionAgentConfig, DecisionAgentRecord } from "./types";

function mapRow(row: Record<string, unknown>): DecisionAgentRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    slug: String(row.slug),
    purpose: String(row.purpose),
    decisionType: String(row.decision_type),
    status: String(row.status) as DecisionAgentRecord["status"],
    config: parseDecisionAgentConfigOrDefault(row.config),
    safetySettings: (row.safety_settings ?? {}) as Record<string, unknown>,
    deployment: (row.deployment ?? { version: 0, state: "idle" }) as DecisionAgentRecord["deployment"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDecisionAgents(
  supabase: SupabaseClient,
  params: { userId: string; organizationId: string }
): Promise<DecisionAgentRecord[]> {
  const { data, error } = await supabase
    .from("decision_agents")
    .select("*")
    .eq("user_id", params.userId)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getDecisionAgentBySlug(
  supabase: SupabaseClient,
  params: { organizationId: string; slug: string; userId: string }
): Promise<DecisionAgentRecord | null> {
  const { data, error } = await supabase
    .from("decision_agents")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("slug", params.slug)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function createDecisionAgent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    name: string;
    purpose: string;
    decisionType: string;
    config: DecisionAgentConfig;
  }
): Promise<DecisionAgentRecord> {
  const baseSlug = slugifyAgentId(params.name);
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 5) {
    const { data, error } = await supabase
      .from("decision_agents")
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        name: params.name.trim(),
        slug,
        purpose: params.purpose.trim(),
        decision_type: params.decisionType,
        status: "draft",
        config: params.config,
        safety_settings: { protected: true },
        deployment: { version: 0, state: "idle" },
      })
      .select("*")
      .single();

    if (!error && data) return mapRow(data as Record<string, unknown>);
    if (error?.code !== "23505") throw new Error(error?.message ?? "Could not create decision agent.");
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  throw new Error("Could not create decision agent.");
}

export async function updateDecisionAgent(
  supabase: SupabaseClient,
  params: {
    id: string;
    userId: string;
    patch: Partial<{
      name: string;
      purpose: string;
      status: string;
      config: DecisionAgentConfig;
      safetySettings: Record<string, unknown>;
      deployment: Record<string, unknown>;
    }>;
  }
): Promise<DecisionAgentRecord> {
  const patch: Record<string, unknown> = {};
  if (params.patch.name) patch.name = params.patch.name;
  if (params.patch.purpose) patch.purpose = params.patch.purpose;
  if (params.patch.status) patch.status = params.patch.status;
  if (params.patch.config) patch.config = params.patch.config;
  if (params.patch.safetySettings) patch.safety_settings = params.patch.safetySettings;
  if (params.patch.deployment) patch.deployment = params.patch.deployment;

  const { data, error } = await supabase
    .from("decision_agents")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Decision agent not found.");
  return mapRow(data as Record<string, unknown>);
}
