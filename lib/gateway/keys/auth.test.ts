import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentAuthError } from "@/lib/gateway/errors";
import { extractAgentBearerToken } from "./auth";
import {
  generateAgentApiKeyMaterial,
  hashAgentApiKey,
} from "./crypto";
import type { AgentApiKeyRow } from "./repository";
import { authenticateAgentApiKey } from "./service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

function buildRow(
  overrides: Partial<AgentApiKeyRow> & Pick<AgentApiKeyRow, "organization_id" | "agent_id">
): AgentApiKeyRow {
  const material = generateAgentApiKeyMaterial();

  return {
    id: overrides.id ?? "33333333-3333-4333-8333-333333333333",
    organization_id: overrides.organization_id,
    agent_id: overrides.agent_id,
    name: overrides.name ?? "Test key",
    key_prefix: overrides.key_prefix ?? material.keyPrefix,
    key_hash: overrides.key_hash ?? material.keyHash,
    created_by: overrides.created_by ?? null,
    last_used_at: overrides.last_used_at ?? null,
    revoked_at: overrides.revoked_at ?? null,
    expires_at: overrides.expires_at ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function createAuthDeps(store: Map<string, AgentApiKeyRow>) {
  return {
    findByHash: async (_supabase: SupabaseClient, keyHash: string) =>
      store.get(keyHash) ?? null,
    touchLastUsed: async () => {},
  };
}

describe("extractAgentBearerToken", () => {
  it("parses Authorization Bearer header", () => {
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer al_test_token" },
    });

    assert.equal(extractAgentBearerToken(request), "al_test_token");
  });

  it("returns null when header is missing", () => {
    const request = new Request("https://example.com");
    assert.equal(extractAgentBearerToken(request), null);
  });
});

describe("authenticateAgentApiKey", () => {
  it("accepts a valid key and returns organization context", async () => {
    const material = generateAgentApiKeyMaterial();
    const row = buildRow({
      organization_id: ORG_A,
      agent_id: "agent-001",
      key_prefix: material.keyPrefix,
      key_hash: material.keyHash,
    });

    const store = new Map([[material.keyHash, row]]);
    const supabase = {} as SupabaseClient;

    const context = await authenticateAgentApiKey(
      supabase,
      material.plainKey,
      createAuthDeps(store)
    );

    assert.equal(context.organizationId, ORG_A);
    assert.equal(context.agentId, "agent-001");
    assert.equal(context.keyPrefix, material.keyPrefix);
  });

  it("rejects an invalid key", async () => {
    const material = generateAgentApiKeyMaterial();
    const row = buildRow({
      organization_id: ORG_A,
      agent_id: "agent-001",
      key_prefix: material.keyPrefix,
      key_hash: material.keyHash,
    });

    const store = new Map([[material.keyHash, row]]);
    const supabase = {} as SupabaseClient;

    await assert.rejects(
      () =>
        authenticateAgentApiKey(
          supabase,
          `${material.plainKey}-tampered`,
          createAuthDeps(store)
        ),
      (err: unknown) => {
        assert.ok(err instanceof AgentAuthError);
        assert.equal(err.code, "invalid_token");
        return true;
      }
    );
  });

  it("rejects a revoked key", async () => {
    const material = generateAgentApiKeyMaterial();
    const row = buildRow({
      organization_id: ORG_A,
      agent_id: "agent-001",
      key_prefix: material.keyPrefix,
      key_hash: material.keyHash,
      revoked_at: new Date().toISOString(),
    });

    const store = new Map([[material.keyHash, row]]);
    const supabase = {} as SupabaseClient;

    await assert.rejects(
      () =>
        authenticateAgentApiKey(
          supabase,
          material.plainKey,
          createAuthDeps(store)
        ),
      (err: unknown) => {
        assert.ok(err instanceof AgentAuthError);
        assert.equal(err.code, "revoked_token");
        return true;
      }
    );
  });

  it("isolates organization context per stored key", async () => {
    const materialA = generateAgentApiKeyMaterial();
    const materialB = generateAgentApiKeyMaterial();

    const rowA = buildRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organization_id: ORG_A,
      agent_id: "agent-a",
      key_prefix: materialA.keyPrefix,
      key_hash: materialA.keyHash,
    });

    const rowB = buildRow({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organization_id: ORG_B,
      agent_id: "agent-b",
      key_prefix: materialB.keyPrefix,
      key_hash: materialB.keyHash,
    });

    const store = new Map([
      [materialA.keyHash, rowA],
      [materialB.keyHash, rowB],
    ]);
    const supabase = {} as SupabaseClient;
    const deps = createAuthDeps(store);

    const contextA = await authenticateAgentApiKey(
      supabase,
      materialA.plainKey,
      deps
    );
    const contextB = await authenticateAgentApiKey(
      supabase,
      materialB.plainKey,
      deps
    );

    assert.equal(contextA.organizationId, ORG_A);
    assert.equal(contextB.organizationId, ORG_B);
    assert.notEqual(contextA.organizationId, contextB.organizationId);
    assert.equal(hashAgentApiKey(materialA.plainKey), materialA.keyHash);
    assert.equal(hashAgentApiKey(materialB.plainKey), materialB.keyHash);
  });
});
