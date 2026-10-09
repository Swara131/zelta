"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  Shield,
  Wrench,
} from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import { loadCreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import { loadAgentLifecycle } from "@/lib/agent-builder/agent-lifecycle";
import {
  getAgentDisplayStatus,
  getAgentProtectHref,
  isStandaloneAgent,
} from "@/lib/agents/agent-mode";
import {
  bumpWorkspaceStats,
  loadWorkspaceMessages,
  loadWorkspaceRuns,
  loadWorkspaceStats,
  saveWorkspaceMessage,
  saveWorkspaceRun,
  type WorkspaceMessage,
} from "@/lib/agents/agent-workspace-storage";
import AgentResultRenderer from "@/components/agents/results/AgentResultRenderer";
import AgentProtectionApproval from "@/components/agents/AgentProtectionApproval";
import type { RiskSeverity } from "@/lib/risk-types";

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  const response = await fetch("/api/gateway/keys");
  const payload = (await response.json()) as { keys?: AgentApiKeyRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Failed to load agents.");
  return payload.keys ?? [];
}


export default function AgentWorkspacePage() {
  const params = useParams();
  const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "";

  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [runs, setRuns] = useState(loadWorkspaceRuns(agentId));
  const [stats, setStats] = useState(loadWorkspaceStats(agentId));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{
    proposalId: string;
    runId: string | null;
    summary: string;
    why: string;
    riskLevel: RiskSeverity;
    details?: Record<string, unknown>;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const session = useMemo(
    () => (agentId ? loadCreatedAgentSession(agentId) : null),
    [agentId]
  );

  const spec = session?.spec ?? null;
  const agentName = spec?.name ?? agentId;
  const lifecycle = useMemo(
    () => (agentId ? loadAgentLifecycle(agentId) : loadAgentLifecycle("")),
    [agentId]
  );

  const key = useMemo(
    () => keys.find((item) => !item.revokedAt && item.agentId === agentId) ?? null,
    [keys, agentId]
  );

  const display = useMemo(
    () => getAgentDisplayStatus(lifecycle, key, "Created with Wave"),
    [lifecycle, key]
  );

  const instructions =
    spec?.purpose ?? spec?.summary ?? "This agent is ready to chat and run configured actions.";

  useEffect(() => {
    void fetchAgentKeys()
      .then(setKeys)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!agentId) return;
    setMessages(loadWorkspaceMessages(agentId));
    setRuns(loadWorkspaceRuns(agentId));
    setStats(loadWorkspaceStats(agentId));
  }, [agentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !agentId || sending) return;

    setSending(true);
    setDraft("");

    const userMessage: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    saveWorkspaceMessage(agentId, userMessage);

    let agentContent = "Running your agent…";
    let runStatus = "running";
    let runSummary = `Running: "${text.slice(0, 48)}${text.length > 48 ? "…" : ""}"`;

    try {
      const response = await fetch(`/api/v1/agents/run/${encodeURIComponent(agentId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: text, mode: "manual" }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        needsInput?: boolean;
        result?: {
          status?: string;
          summary?: string | null;
          error?: string | null;
          runId?: string | null;
          proposalId?: string | null;
          protection?: {
            summary?: string;
            why?: string;
            riskLevel?: RiskSeverity;
            details?: Record<string, unknown>;
          };
        };
        error?: string;
      };

      if (payload.needsInput && payload.result?.summary) {
        agentContent = payload.result.summary;
        runStatus = "needs_input";
        runSummary = payload.result.summary;
      } else if (response.ok && payload.result) {
        runStatus = payload.result.status ?? "completed";
        if (payload.result.status === "awaiting_approval") {
          agentContent =
            payload.result.summary ??
            "Wave Protection paused your agent until you approve the next action.";
          if (payload.result.proposalId) {
            setPendingApproval({
              proposalId: payload.result.proposalId,
              runId: payload.result.runId ?? null,
              summary:
                payload.result.protection?.summary ??
                payload.result.summary ??
                "Your agent wants to take an action that needs approval.",
              why:
                payload.result.protection?.why ??
                payload.result.error ??
                "This action has a higher impact than automatic actions.",
              riskLevel: payload.result.protection?.riskLevel ?? "medium",
              details: payload.result.protection?.details,
            });
          }
        } else if (payload.result.status === "completed") {
          setPendingApproval(null);
          agentContent =
            payload.result.summary ?? "The agent finished without a written result.";
        } else if (payload.result.error) {
          agentContent = payload.result.error;
        } else {
          agentContent = payload.result.summary ?? "The agent could not finish this request.";
          if (payload.result.status && payload.result.status !== "completed") {
            runStatus = payload.result.status;
          }
        }
        runSummary = payload.result.summary ?? runSummary;
      } else if (payload.error) {
        agentContent = payload.error;
        runStatus = "failed";
      }
    } catch {
      agentContent = "Could not run your agent right now. Try again.";
      runStatus = "failed";
    }

    const agentMessage: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: "agent",
      content: agentContent,
      createdAt: new Date().toISOString(),
    };

    saveWorkspaceMessage(agentId, agentMessage);
    saveWorkspaceRun(agentId, {
      id: crypto.randomUUID(),
      summary: runSummary,
      status: runStatus,
      createdAt: new Date().toISOString(),
    });

    const nextStats = bumpWorkspaceStats(agentId, {
      messagesSent: stats.messagesSent + 1,
      runsCompleted:
        runStatus === "completed" ? stats.runsCompleted + 1 : stats.runsCompleted,
    });

    setMessages(loadWorkspaceMessages(agentId));
    setRuns(loadWorkspaceRuns(agentId));
    setStats(nextStats);
    setSending(false);
  }, [
    agentId,
    draft,
    sending,
    stats.messagesSent,
    stats.runsCompleted,
    setMessages,
    setRuns,
    setDraft,
    setSending,
    setPendingApproval,
    setStats,
  ]);

  if (!agentId) {
    return (
      <PageShell maxWidth="6xl">
        <p>Agent not found.</p>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell maxWidth="6xl">
        <div className="asw-loading">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Opening workspace…
        </div>
      </PageShell>
    );
  }

  const protectHref = getAgentProtectHref(agentId);
  const standalone = isStandaloneAgent(lifecycle);

  return (
    <PageShell maxWidth="6xl" className="asw-page">
      <div className="asw-layout fade-in-up">
        <Link href="/integrations" className="ag-back-link">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          My Agents
        </Link>

        <header className="asw-header">
          <div className="asw-header-main">
            <span className="asw-header-icon" aria-hidden="true">
              <Bot strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="asw-title">{agentName}</h1>
              <p className="asw-subtitle">Agent Workspace · Build and use without protection required</p>
            </div>
          </div>
          <div className="asw-header-badges">
            <span className="asw-badge asw-badge-active">
              {display.runtimeStatus === "active" ? "Active" : "Paused"}
            </span>
            {display.protected ? (
              <span className="asw-badge asw-badge-protected">Protected</span>
            ) : (
              <span className="asw-badge asw-badge-unprotected">Unprotected</span>
            )}
          </div>
        </header>

        <div className="asw-grid">
          <section className="asw-chat-card" aria-label="Agent conversation">
            <div className="asw-chat-head">
              <h2>Conversation</h2>
              <p>Interact with your agent directly in Wave</p>
            </div>

            <div className="asw-chat-log">
              {messages.length === 0 ? (
                <div className="asw-chat-empty">
                  <p>Start a conversation with {agentName}.</p>
                  <p className="asw-chat-empty-hint">
                    Try: &ldquo;Help me send a customer update email&rdquo;
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`asw-chat-bubble asw-chat-bubble-${message.role}`}
                  >
                    <span className="asw-chat-role">
                      {message.role === "user" ? "You" : agentName}
                    </span>
                    {message.role === "agent" ? (
                      <AgentResultRenderer result={message.content} variant="chat" />
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                ))
              )}
              {sending ? (
                <div className="asw-chat-bubble asw-chat-bubble-agent">
                  <span className="asw-chat-role">{agentName}</span>
                  <p className="asw-chat-typing">Thinking…</p>
                </div>
              ) : null}
              {pendingApproval ? (
                <AgentProtectionApproval
                  proposalId={pendingApproval.proposalId}
                  runId={pendingApproval.runId}
                  summary={pendingApproval.summary}
                  why={pendingApproval.why}
                  riskLevel={pendingApproval.riskLevel}
                  details={pendingApproval.details}
                  onResolved={(result) => {
                    setPendingApproval(null);
                    const content =
                      result.decision === "approved"
                        ? result.runSummary ??
                          "Thanks — Wave approved the action and continued your agent run."
                        : "You rejected this action. Wave stopped the agent and logged your decision.";
                    const agentMessage: WorkspaceMessage = {
                      id: crypto.randomUUID(),
                      role: "agent",
                      content,
                      createdAt: new Date().toISOString(),
                    };
                    saveWorkspaceMessage(agentId, agentMessage);
                    setMessages(loadWorkspaceMessages(agentId));
                  }}
                />
              ) : null}
              <div ref={chatEndRef} />
            </div>

            <form
              className="asw-chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <input
                className="asw-chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Send a message to your agent…"
                aria-label="Message"
              />
              <button type="submit" className="asw-chat-send" disabled={!draft.trim() || sending}>
                <Send className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Send
              </button>
            </form>
          </section>

          <aside className="asw-sidebar">
            <section className="asw-panel">
              <h3>Agent instructions</h3>
              <p>{instructions}</p>
            </section>

            <section className="asw-panel">
              <h3>
                <Wrench className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Available tools
              </h3>
              <ul className="asw-tools">
                {(spec?.tools ?? []).length > 0 ? (
                  spec!.tools.map((tool) => (
                    <li key={tool.id}>
                      <code>{tool.toolName}</code>
                      <span>{tool.label}</span>
                    </li>
                  ))
                ) : (
                  <li className="asw-tools-empty">General assistant actions</li>
                )}
              </ul>
            </section>

            <section className="asw-panel">
              <h3>Usage</h3>
              <dl className="asw-stats">
                <div>
                  <dt>Messages sent</dt>
                  <dd>{stats.messagesSent}</dd>
                </div>
                <div>
                  <dt>Runs completed</dt>
                  <dd>{stats.runsCompleted}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{display.statusLabel}</dd>
                </div>
              </dl>
            </section>

            <section className="asw-panel">
              <h3>Recent runs</h3>
              {runs.length === 0 ? (
                <p className="asw-muted">No runs yet — send a message to start.</p>
              ) : (
                <ul className="asw-runs">
                  {runs.slice(0, 5).map((run) => (
                    <li key={run.id}>
                      <span>{run.summary}</span>
                      <time dateTime={run.createdAt}>
                        {new Date(run.createdAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {standalone && !display.protected ? (
              <section className="asw-protect-card">
                <Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <h3>Protect with Wave</h3>
                  <p>
                    Optional — route actions through policy checks, risk analysis, and human
                    approval when you&apos;re ready.
                  </p>
                  <Link href={protectHref} className="asw-protect-btn">
                    Protect with Wave →
                  </Link>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
