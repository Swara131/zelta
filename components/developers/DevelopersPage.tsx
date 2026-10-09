"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Key,
  Loader2,
  Plus,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import {
  buildDeveloperFlowExample,
  DEVELOPER_DECISIONS,
  DEVELOPER_DOC_LINKS,
  DEVELOPER_QUICK_START,
  DEVELOPER_RESPONSE_EXAMPLE,
  type DeveloperExampleLanguage,
} from "@/lib/developers/developer-copy";

const LANG_TABS: { id: DeveloperExampleLanguage; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
];

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load API keys.");
  }
  return payload.keys ?? [];
}

function decisionClass(decision: "ALLOW" | "REVIEW" | "BLOCK"): string {
  switch (decision) {
    case "ALLOW":
      return "dev-decision-allow";
    case "REVIEW":
      return "dev-decision-review";
    case "BLOCK":
      return "dev-decision-block";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DevelopersPage() {
  const [lang, setLang] = useState<DeveloperExampleLanguage>("typescript");
  const [copied, setCopied] = useState(false);
  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("demo-refund-agent");
  const [keyName, setKeyName] = useState("Production agent");

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const exampleAgentId = keys.find((key) => !key.revokedAt)?.agentId ?? agentId;

  const code = useMemo(
    () =>
      buildDeveloperFlowExample(
        { baseUrl, agentId: exampleAgentId },
        lang
      ),
    [baseUrl, exampleAgentId, lang]
  );

  const loadKeys = useCallback(async () => {
    setKeysError(null);
    try {
      const result = await fetchAgentKeys();
      setKeys(result);
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const activeKeys = keys.filter((key) => !key.revokedAt);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateKey = async () => {
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
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create API key.");
      }

      if (payload.plainKey) {
        setRevealedKey(payload.plainKey);
      }

      await loadKeys();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageShell maxWidth="6xl" className="dev-page">
      <PageHeader
        icon={Terminal}
        title="Connect Your AI Agent"
        description="Route tool calls through Wave before your agent executes high-impact actions."
      />

      <section className="ds-section" aria-labelledby="dev-quickstart-heading">
        <h2 id="dev-quickstart-heading" className="dev-section-title">
          Get started in 3 steps
        </h2>
        <ol className="dev-steps">
          {DEVELOPER_QUICK_START.map((step) => (
            <li key={step.step} className="dev-step ds-panel">
              <span className="dev-step-num">{step.step}</span>
              <div>
                <h3 className="dev-step-title">{step.title}</h3>
                <p className="dev-step-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="ds-section" aria-labelledby="dev-example-heading">
        <div className="dev-example-header">
          <div>
            <h2 id="dev-example-heading" className="dev-section-title">
              API example
            </h2>
            <p className="dev-section-desc">
              Propose an action, read Wave&apos;s decision, then execute only when allowed.
            </p>
          </div>
          <div className="dev-lang-tabs" role="tablist" aria-label="Code language">
            {LANG_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={lang === tab.id}
                onClick={() => setLang(tab.id)}
                className={`dev-lang-tab ${lang === tab.id ? "dev-lang-tab-active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dev-code-panel ds-panel">
          <div className="dev-code-toolbar">
            <span className="dev-code-endpoint">
              <Code2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              POST /api/v1/actions/propose
            </span>
            <button type="button" className="dev-copy-btn" onClick={() => void handleCopy()}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="dev-code-block">
            <code>{code}</code>
          </pre>
        </div>

        <details className="cp-advanced-setup dev-response-details">
          <summary className="cp-advanced-setup-summary">
            Example propose response
            <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </summary>
          <div className="cp-advanced-setup-body">
            <pre className="ab-spec-json">{DEVELOPER_RESPONSE_EXAMPLE}</pre>
          </div>
        </details>
      </section>

      <section className="ds-section" aria-labelledby="dev-decisions-heading">
        <h2 id="dev-decisions-heading" className="dev-section-title">
          Decision responses
        </h2>
        <div className="dev-decision-grid">
          {DEVELOPER_DECISIONS.map((item) => (
            <article
              key={item.decision}
              className={`dev-decision-card ds-panel ${decisionClass(item.decision)}`}
            >
              <h3 className="dev-decision-name">{item.title}</h3>
              <p className="dev-decision-code">{item.decision}</p>
              <p className="dev-decision-desc">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ds-section" aria-labelledby="dev-keys-heading">
        <div className="dev-keys-header">
          <div>
            <h2 id="dev-keys-heading" className="dev-section-title">
              API keys
            </h2>
            <p className="dev-section-desc">
              Bearer tokens for <code className="font-mono text-xs">/api/v1/*</code> agent routes.
              Plaintext keys are shown once at creation in My Agents.
            </p>
          </div>
        </div>

        {keysError ? (
          <p className="text-sm text-red-400" role="alert">
            {keysError}
          </p>
        ) : null}

        {keysLoading ? (
          <div className="dev-loading">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading API keys…
          </div>
        ) : activeKeys.length > 0 ? (
          <ul className="dev-key-list">
            {activeKeys.map((key) => (
              <li key={key.id} className="dev-key-item ds-panel">
                <Key className="h-4 w-4 text-[var(--ds-brand)]" strokeWidth={2} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="dev-key-name">{key.name}</p>
                  <p className="dev-key-meta">
                    Agent <code className="font-mono">{key.agentId}</code> · Prefix{" "}
                    <code className="font-mono">{key.keyPrefix}…</code> · Created{" "}
                    {formatDate(key.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dev-section-desc">No API keys yet. Create one below to connect your agent.</p>
        )}

        <div className="dev-key-create ds-panel">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="dev-filter-label">Agent ID</span>
              <input
                className="ds-input w-full"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="demo-refund-agent"
              />
            </label>
            <label className="block">
              <span className="dev-filter-label">Key name</span>
              <input
                className="ds-input w-full"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Production agent"
              />
            </label>
          </div>

          {createError ? (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {createError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={Plus}
              loading={creating}
              onClick={() => void handleCreateKey()}
            >
              Create API key
            </Button>
            <Link href="/integrations" className="ds-btn ds-btn-secondary">
              Manage keys in My Agents
            </Link>
          </div>
        </div>

        {revealedKey ? (
          <div
            className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/8 p-6"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-amber-200">Copy your API key now</h3>
                <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">
                  This plaintext key will not be shown again.
                </p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-200">
                  {revealedKey}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ds-btn ds-btn-ghost ds-btn-sm inline-flex items-center gap-1.5"
                    onClick={() => void navigator.clipboard.writeText(revealedKey)}
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    Copy
                  </button>
                  <Button variant="secondary" size="sm" onClick={() => setRevealedKey(null)}>
                    I have saved the key
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ds-section" aria-labelledby="dev-docs-heading">
        <h2 id="dev-docs-heading" className="dev-section-title">
          Documentation
        </h2>
        <div className="dev-doc-grid">
          {DEVELOPER_DOC_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="dev-doc-card ds-panel group">
              <div>
                <p className="dev-doc-label">{link.label}</p>
                <p className="dev-doc-desc">{link.description}</p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
        <p className="dev-section-desc mt-3">
          TypeScript SDK: copy <code className="font-mono text-xs">lib/gateway/client.ts</code>{" "}
          (<code className="font-mono text-xs">ApprovalLayerAgentClient</code>) from this repository,
          or call the HTTP API directly as shown above.
        </p>
      </section>
    </PageShell>
  );
}
