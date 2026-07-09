import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentApiKeyRecord, AgentAuthContext, CreatedAgentApiKey } from "@/lib/gateway/types";
import { AgentAuthError, AgentKeyError } from "@/lib/gateway/errors";
import {
  generateAgentApiKeyMaterial,
  hashAgentApiKey,
  isPlausibleAgentApiKey,
  verifyAgentApiKey,
} from "./crypto";
import {
  findAgentApiKeyByHash,
  insertAgentApiKey,
  listAgentApiKeysForOrganization,
  revokeAgentApiKey,
  touchAgentApiKeyLastUsed,
  type AgentApiKeyRow,
} from "./repository";

function mapKeyRow(row: AgentApiKeyRow): AgentApiKeyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdBy: row.created_by,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isExpired(row: AgentApiKeyRow): boolean {
  if (!row.expires_at) {
    return false;
  }
  return new Date(row.expires_at).getTime() <= Date.now();
}

export async function createAgentApiKey(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    agentId: string;
    name: string;
    createdBy: string;
    expiresAt?: string | null;
  }
): Promise<CreatedAgentApiKey> {
  const material = generateAgentApiKeyMaterial();

  const row = await insertAgentApiKey(supabase, {
    organizationId: params.organizationId,
    agentId: params.agentId.trim(),
    name: params.name.trim(),
    keyPrefix: material.keyPrefix,
    keyHash: material.keyHash,
    createdBy: params.createdBy,
    expiresAt: params.expiresAt ?? null,
  });

  return {
    key: mapKeyRow(row),
    plainKey: material.plainKey,
  };
}

export async function listAgentApiKeys(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AgentApiKeyRecord[]> {
  const rows = await listAgentApiKeysForOrganization(supabase, organizationId);
  return rows.map(mapKeyRow);
}

export async function revokeAgentApiKeyForOrganization(
  supabase: SupabaseClient,
  params: { keyId: string; organizationId: string }
): Promise<AgentApiKeyRecord> {
  const row = await revokeAgentApiKey(supabase, params);
  return mapKeyRow(row);
}

export interface AuthenticateAgentApiKeyDeps {
  findByHash: typeof findAgentApiKeyByHash;
  touchLastUsed: typeof touchAgentApiKeyLastUsed;
}

const defaultAuthDeps: AuthenticateAgentApiKeyDeps = {
  findByHash: findAgentApiKeyByHash,
  touchLastUsed: touchAgentApiKeyLastUsed,
};

/**
 * Validates a plaintext agent API key and returns org-scoped auth context.
 * Uses service-role Supabase client (no user session).
 */
export async function authenticateAgentApiKey(
  supabase: SupabaseClient,
  plainKey: string,
  deps: AuthenticateAgentApiKeyDeps = defaultAuthDeps
): Promise<AgentAuthContext> {
  const trimmed = plainKey.trim();

  if (!trimmed) {
    throw new AgentAuthError("missing_token", "Missing agent API key.");
  }

  if (!isPlausibleAgentApiKey(trimmed)) {
    throw new AgentAuthError("invalid_token", "Invalid agent API key.");
  }

  const keyHash = hashAgentApiKey(trimmed);
  const row = await deps.findByHash(supabase, keyHash);

  if (!row) {
    throw new AgentAuthError("invalid_token", "Invalid agent API key.");
  }

  if (!verifyAgentApiKey(trimmed, row.key_hash)) {
    throw new AgentAuthError("invalid_token", "Invalid agent API key.");
  }

  if (row.revoked_at) {
    throw new AgentAuthError("revoked_token", "Agent API key has been revoked.");
  }

  if (isExpired(row)) {
    throw new AgentAuthError("expired_token", "Agent API key has expired.");
  }

  void deps.touchLastUsed(supabase, row.id);

  return {
    keyId: row.id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    keyPrefix: row.key_prefix,
  };
}

export { mapKeyRow, isExpired as isAgentApiKeyExpired };
