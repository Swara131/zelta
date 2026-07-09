import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentKeyError } from "@/lib/gateway/errors";

export type AgentApiKeyRow = {
  id: string;
  organization_id: string;
  agent_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

const KEY_COLUMNS =
  "id, organization_id, agent_id, name, key_prefix, key_hash, created_by, last_used_at, revoked_at, expires_at, created_at, updated_at";

export async function insertAgentApiKey(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    agentId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    createdBy: string;
    expiresAt?: string | null;
  }
): Promise<AgentApiKeyRow> {
  const { data, error } = await supabase
    .from("agent_api_keys")
    .insert({
      organization_id: params.organizationId,
      agent_id: params.agentId,
      name: params.name,
      key_prefix: params.keyPrefix,
      key_hash: params.keyHash,
      created_by: params.createdBy,
      expires_at: params.expiresAt ?? null,
    })
    .select(KEY_COLUMNS)
    .single();

  if (error || !data) {
    throw new AgentKeyError(error?.message ?? "Failed to create agent API key.");
  }

  return data as AgentApiKeyRow;
}

export async function listAgentApiKeysForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AgentApiKeyRow[]> {
  const { data, error } = await supabase
    .from("agent_api_keys")
    .select(KEY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AgentKeyError(error.message);
  }

  return (data ?? []) as AgentApiKeyRow[];
}

export async function findAgentApiKeyByHash(
  supabase: SupabaseClient,
  keyHash: string
): Promise<AgentApiKeyRow | null> {
  const { data, error } = await supabase
    .from("agent_api_keys")
    .select(KEY_COLUMNS)
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) {
    throw new AgentKeyError(error.message);
  }

  return (data as AgentApiKeyRow | null) ?? null;
}

export async function revokeAgentApiKey(
  supabase: SupabaseClient,
  params: { keyId: string; organizationId: string }
): Promise<AgentApiKeyRow> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_api_keys")
    .update({ revoked_at: now })
    .eq("id", params.keyId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .select(KEY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new AgentKeyError(error.message);
  }

  if (!data) {
    throw new AgentKeyError("Agent API key not found or already revoked.");
  }

  return data as AgentApiKeyRow;
}

export async function touchAgentApiKeyLastUsed(
  supabase: SupabaseClient,
  keyId: string
): Promise<void> {
  const { error } = await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) {
    console.error("[gateway] Failed to update last_used_at:", keyId, error.message);
  }
}
