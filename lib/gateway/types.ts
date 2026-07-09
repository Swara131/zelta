/** Context established after successful agent API key authentication. */
export interface AgentAuthContext {
  keyId: string;
  organizationId: string;
  agentId: string;
  keyPrefix: string;
}

/** Public metadata returned when listing keys (never includes hash or plaintext). */
export interface AgentApiKeyRecord {
  id: string;
  organizationId: string;
  agentId: string;
  name: string;
  keyPrefix: string;
  createdBy: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Returned once at key creation — plaintext is not persisted. */
export interface CreatedAgentApiKey {
  key: AgentApiKeyRecord;
  plainKey: string;
}
