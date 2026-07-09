"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plug,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Code2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import {
  buildProposeExamples,
  buildStatusExamples,
  buildVerifyExamples,
  type IntegrationExampleLanguage,
} from "@/lib/gateway/integration-examples";

type ExampleTab = "propose" | "status" | "verify";
type LangTab = IntegrationExampleLanguage;

interface CreatedKeyReveal {
  plainKey: string;
  keyPrefix: string;
  agentId: string;
}

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load agent API keys.");
  }
  return payload.keys ?? [];
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="ds-btn ds-btn-ghost ds-btn-sm inline-flex items-center gap-1.5"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function IntegrationsPage() {
  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<CreatedKeyReveal | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [agentId, setAgentId] = useState("demo-refund-agent");
  const [keyName, setKeyName] = useState("Local demo agent");

  const [exampleTab, setExampleTab] = useState<ExampleTab>("propose");
  const [langTab, setLangTab] = useState<LangTab>("curl");

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const exampleAgentId = keys[0]?.agentId ?? agentId;
  const exampleProposalId = "00000000-0000-4000-8000-000000000001";

  const examples = useMemo(() => {
    const params = { baseUrl, agentId: exampleAgentId };
    if (exampleTab === "propose") {
      return buildProposeExamples(params);
    }
    if (exampleTab === "status") {
      return buildStatusExamples({ ...params, proposalId: exampleProposalId });
    }
    return buildVerifyExamples({ ...params, proposalId: exampleProposalId });
  }, [baseUrl, exampleAgentId, exampleProposalId, exampleTab]);

  const loadKeys = useCallback(async () => {
    setLoadError(null);
    try {
      const items = await fetchAgentKeys();
      setKeys(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const activeKeys = keys.filter((key) => !key.revokedAt);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/gateway/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, name: keyName }),
      });

      const payload = (await response.json()) as {
        plainKey?: string;
        key?: AgentApiKeyRecord;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create agent API key.");
      }

      if (!payload.plainKey || !payload.key) {
        throw new Error("Unexpected response from key creation.");
      }

      setRevealedKey({
        plainKey: payload.plainKey,
        keyPrefix: payload.key.keyPrefix,
        agentId: payload.key.agentId,
      });

      await loadKeys();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/gateway/keys/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to revoke key.");
      }
      await loadKeys();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to revoke key.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <PageShell maxWidth="4xl">
      <PageHeader
        icon={Plug}
        title="Developer Integration"
        description="Create agent API keys and connect external agents to the pre-execution gateway. Plaintext keys are shown once at creation — only prefixes are stored in the dashboard."
        badge={
          <span className="ds-badge ds-badge-brand">
            <Key className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {activeKeys.length} active keys
          </span>
        }
      />

      <section className="ds-section grid grid-cols-3 gap-3 sm:max-w-lg" aria-label="Key statistics">
        {[
          { label: "Total keys", value: keys.length },
          { label: "Active", value: activeKeys.length },
          { label: "Revoked", value: keys.filter((k) => k.revokedAt).length },
        ].map(({ label, value }) => (
          <div key={label} className="ds-stat-card">
            <p className="ds-stat-label">{label}</p>
            <p className="ds-stat-value">{value}</p>
          </div>
        ))}
      </section>

      <section className="ds-section ds-panel p-6">
        <h2 className="text-sm font-semibold text-zinc-100">Create agent API key</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Organization admins only. The full key is displayed once — copy it before closing the
          reveal dialog.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Agent ID</span>
            <input
              className="ds-input w-full"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="demo-refund-agent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Key name</span>
            <input
              className="ds-input w-full"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Local demo agent"
            />
          </label>
        </div>

        {createError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {createError}
          </p>
        )}

        <div className="mt-4">
          <Button
            variant="primary"
            icon={Plus}
            loading={creating}
            onClick={() => void handleCreate()}
          >
            Create API key
          </Button>
        </div>
      </section>

      {revealedKey && (
        <section className="ds-section rounded-xl border border-amber-400/25 bg-amber-500/8 p-6" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-200">Copy your API key now</h2>
              <p className="mt-1 text-sm text-zinc-400">
                This plaintext key will not be shown again. Store it in{" "}
                <code className="text-zinc-300">AGENT_API_KEY</code> for the demo agent.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Prefix: <code className="font-mono">{revealedKey.keyPrefix}</code> · Agent:{" "}
                <code className="font-mono">{revealedKey.agentId}</code>
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-200">
                {revealedKey.plainKey}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={revealedKey.plainKey} />
                <Button variant="secondary" size="sm" onClick={() => setRevealedKey(null)}>
                  I have saved the key
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="ds-section">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">Agent API keys</h2>

        {loadError && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading keys…</p>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No agent API keys"
            description="Create a key to connect your first external agent to the gateway."
          />
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <article key={key.id} className="ds-panel p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-zinc-100">{key.name}</h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          key.revokedAt
                            ? "bg-red-500/15 text-red-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {key.revokedAt ? "Revoked" : "Active"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {key.keyPrefix}… · {key.agentId}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Last used: {formatTimestamp(key.lastUsedAt)}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Created: {formatTimestamp(key.createdAt)}
                    </p>
                  </div>

                  {!key.revokedAt && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      loading={revokingId === key.id}
                      onClick={() => void handleRevoke(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ds-section ds-panel p-6">
        <div className="mb-4 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-indigo-400" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-zinc-100">Integration examples</h2>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Example endpoint">
          {(
            [
              ["propose", "Propose action"],
              ["status", "Poll status"],
              ["verify", "Verify execution"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={exampleTab === key}
              onClick={() => setExampleTab(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                exampleTab === key
                  ? "bg-[var(--ds-brand)] text-white"
                  : "bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Example language">
          {(
            [
              ["curl", "curl"],
              ["typescript", "TypeScript"],
              ["python", "Python"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={langTab === key}
              onClick={() => setLangTab(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                langTab === key
                  ? "bg-indigo-500/25 text-indigo-200"
                  : "bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <pre className="max-h-80 overflow-auto rounded-lg bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-300">
            {examples[langTab]}
          </pre>
          <div className="absolute right-3 top-3">
            <CopyButton text={examples[langTab]} />
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-600">
          Run the safe demo locally:{" "}
          <code className="text-zinc-400">npm run demo:agent -- allow|review|block</code>
        </p>
      </section>
    </PageShell>
  );
}
