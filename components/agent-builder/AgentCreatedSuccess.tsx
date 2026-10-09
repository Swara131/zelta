"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Play,
  Shield,
} from "lucide-react";
import type { CreatedAgentSession } from "@/lib/agent-builder/created-agent-session";
import {
  AGENT_CREATED_EXPLANATION,
  AGENT_CREATED_NEXT_STEP,
  buildCreatedAgentViewModel,
} from "@/lib/agent-builder/created-agent-view";
import { useState } from "react";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

interface AgentCreatedSuccessProps {
  session: CreatedAgentSession;
}

export default function AgentCreatedSuccess({ session }: AgentCreatedSuccessProps) {
  const view = buildCreatedAgentViewModel(session.spec);
  const connectHref = `/onboarding/connect/wizard?agent=${encodeURIComponent(session.agentId)}&platform=zelta`;
  const testHref = `/test-action?agent=${encodeURIComponent(session.agentId)}`;
  const protectionHref = "/risk";

  return (
    <div className="ac-page fade-in-up">
      <div className="ac-success-badge">
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        Agent Created Successfully
      </div>

      <h1 className="ac-title">Your AI Agent is protected by Wave</h1>

      <article className="ac-card ds-panel">
        <div className="ac-card-header">
          <div className="ac-card-icon" aria-hidden="true">
            <Shield className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="ac-kicker">Agent overview</p>
            <h2 className="ac-agent-name">{view.name}</h2>
          </div>
          <div className="ac-status-group">
            <span className="ac-status ac-status-protected">{view.status}</span>
            <span className="ac-status ac-status-active">{view.statusDetail}</span>
          </div>
        </div>

        <dl className="ac-meta-grid">
          <div>
            <dt>Agent purpose</dt>
            <dd>&ldquo;{view.purpose}&rdquo;</dd>
          </div>
          <div>
            <dt>Protection mode</dt>
            <dd>{view.protectionMode}</dd>
          </div>
        </dl>

        <div className="ac-counts">
          <article className="ac-count ac-count-allow">
            <p className="ac-count-value">{view.allowedCount}</p>
            <p className="ac-count-label">Allowed actions</p>
          </article>
          <article className="ac-count ac-count-review">
            <p className="ac-count-value">{view.reviewCount}</p>
            <p className="ac-count-label">Actions requiring approval</p>
          </article>
          <article className="ac-count ac-count-block">
            <p className="ac-count-value">{view.blockedCount}</p>
            <p className="ac-count-label">Blocked actions</p>
          </article>
        </div>

        <p className="ac-explanation">{AGENT_CREATED_EXPLANATION}</p>
      </article>

      <div className="ac-cta-grid">
        <Link href={connectHref} className="ac-cta-card ds-panel group">
          <span className="ac-cta-icon ac-cta-icon-connect" aria-hidden="true">
            <Link2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="ac-cta-title">Connect This Agent</span>
          <span className="ac-cta-desc">
            Copy your API key and finish wiring your agent to Wave.
          </span>
          <span className="ac-cta-link">
            Open setup
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link href={testHref} className="ac-cta-card ds-panel group">
          <span className="ac-cta-icon ac-cta-icon-test" aria-hidden="true">
            <Play className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="ac-cta-title">Test an Action</span>
          <span className="ac-cta-desc">
            Submit example actions and see how Wave evaluates them in real time.
          </span>
          <span className="ac-cta-link">
            Open simulator
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link href={protectionHref} className="ac-cta-card ds-panel group">
          <span className="ac-cta-icon ac-cta-icon-protection" aria-hidden="true">
            <Shield className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="ac-cta-title">View Protection Rules</span>
          <span className="ac-cta-desc">
            Review how Allow, Review, and Block decisions are applied to agent actions.
          </span>
          <span className="ac-cta-link">
            View rules
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      <p className="ac-next-step">{AGENT_CREATED_NEXT_STEP}</p>

      <section className="ac-key-panel ds-panel" aria-labelledby="ac-key-heading">
        <h2 id="ac-key-heading" className="ac-key-title">
          Your connection key
        </h2>
        <p className="ac-key-desc">
          Copy this key now — it will not be shown again. Your developer needs it to connect
          the agent.
        </p>
        <p className="ac-key-meta">
          Agent ID: <code className="font-mono">{session.agentId}</code> · Prefix{" "}
          <code className="font-mono">{session.keyPrefix}…</code>
        </p>
        <pre className="ac-key-value">{session.plainKey}</pre>
        <div className="ac-key-actions">
          <CopyButton text={session.plainKey} label="Copy key" />
        </div>
      </section>
    </div>
  );
}
