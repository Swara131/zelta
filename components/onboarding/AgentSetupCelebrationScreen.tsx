"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Lock, Shield, Bot } from "lucide-react";

const STATUS_ITEMS = [
  { id: "connected", label: "Agent connected", delayMs: 200 },
  { id: "api-key", label: "API key added", delayMs: 400 },
  { id: "protection", label: "Protection active", delayMs: 600 },
] as const;

const TRUST_LINES = [
  "Every risky action is checked before it runs",
  "High-risk actions wait for your approval",
  "All actions logged in tamper-proof audit trail",
  "You control who approves what",
] as const;

const NEXT_STEP_CARDS = [
  {
    id: "approvals",
    emoji: "🔔",
    title: "Go to Approvals tab",
    description: "See actions waiting for your review",
    href: "/approvals",
    linkLabel: "View approvals →",
  },
  {
    id: "activity",
    emoji: "📊",
    title: "Check the Activity log",
    description: "See all actions your agent took",
    href: "/audit",
    linkLabel: "View activity →",
  },
  {
    id: "policy",
    emoji: "⚙️",
    title: "Fine-tune your rules",
    description: "Adjust thresholds and approval gates",
    href: "/risk",
    linkLabel: "Edit policy →",
  },
] as const;

const SECURITY_BADGES = ["SOC 2 Type II", "Encrypted", "GDPR compliant"] as const;

interface AgentSetupCelebrationScreenProps {
  agentName: string;
  techStack: string;
  tools: string[];
  dashboardHref: string;
}

function CelebrationConfetti() {
  const pieces = Array.from({ length: 24 }, (_, index) => index);

  return (
    <div className="csc-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece}
          className={`csc-confetti-piece csc-confetti-piece-${piece % 3}`}
          style={{
            left: `${4 + (piece * 4.1) % 92}%`,
            animationDelay: `${(piece % 8) * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ShieldUnlockAnimation() {
  return (
    <div className="csc-shield-stage" aria-hidden="true">
      <div className="csc-shield-orbit">
        <span className="csc-orbit-check csc-orbit-check-1">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <span className="csc-orbit-check csc-orbit-check-2">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <span className="csc-orbit-check csc-orbit-check-3">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </div>

      <div className="csc-shield-wrap">
        <div className="csc-shield-left">
          <Shield className="csc-shield-icon" strokeWidth={1.5} />
        </div>
        <div className="csc-shield-right">
          <Shield className="csc-shield-icon" strokeWidth={1.5} />
        </div>
        <div className="csc-shield-agent">
          <Bot className="csc-agent-icon" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

export default function AgentSetupCelebrationScreen({
  agentName,
  techStack,
  tools,
  dashboardHref,
}: AgentSetupCelebrationScreenProps) {
  const toolsLabel = tools.length > 0 ? tools.join(", ") : "Configured at setup";

  return (
    <div className="csc-viewport">
      <CelebrationConfetti />
      <div className="csc-particles" aria-hidden="true">
        <span className="csc-particle csc-particle-1" />
        <span className="csc-particle csc-particle-2" />
        <span className="csc-particle csc-particle-3" />
      </div>

      <div className="csc-layout">
        <aside className="csc-summary-card">
          <p className="csc-summary-kicker">Agent summary</p>
          <dl className="csc-summary-list">
            <div>
              <dt>Agent</dt>
              <dd>{agentName}</dd>
            </div>
            <div>
              <dt>Tech stack</dt>
              <dd>{techStack}</dd>
            </div>
            <div>
              <dt>Tools</dt>
              <dd className="csc-summary-tools">{toolsLabel}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="csc-summary-status">🟢 Live &amp; protected</dd>
            </div>
          </dl>
        </aside>

        <main className="csc-main-card">
          <ShieldUnlockAnimation />

          <h1 className="csc-headline">
            🎉 Your agent is live and protected
            <span className="csc-headline-line" aria-hidden="true" />
          </h1>

          <p className="csc-subtitle">
            Wave is now protecting all your agent&apos;s actions
          </p>

          <ul className="csc-status-list" aria-label="Setup status">
            {STATUS_ITEMS.map((item) => (
              <li
                key={item.id}
                className="csc-status-item"
                style={{ animationDelay: `${item.delayMs}ms` }}
              >
                <CheckCircle2 className="csc-status-icon" strokeWidth={2.5} aria-hidden="true" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <section className="csc-trust-card" aria-labelledby="csc-trust-heading">
            <h2 id="csc-trust-heading" className="csc-trust-title">
              What happens now:
            </h2>
            <ul className="csc-trust-lines">
              {TRUST_LINES.map((line) => (
                <li key={line}>→ {line}</li>
              ))}
            </ul>
          </section>

          <section className="csc-next-grid" aria-label="Next steps">
            {NEXT_STEP_CARDS.map((card, index) => (
              <article
                key={card.id}
                className="csc-next-card"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <span className="csc-next-emoji" aria-hidden="true">
                  {card.emoji}
                </span>
                <h3 className="csc-next-title">{card.title}</h3>
                <p className="csc-next-desc">{card.description}</p>
                <Link href={card.href} className="csc-next-link">
                  {card.linkLabel}
                </Link>
              </article>
            ))}
          </section>

          <div className="csc-cta-wrap">
            <Link href={dashboardHref} className="csc-cta-btn">
              Go to agent dashboard
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>

          <section className="csc-security-banner" aria-labelledby="csc-security-heading">
            <div className="csc-security-accent" aria-hidden="true" />
            <div className="csc-security-body">
              <h2 id="csc-security-heading" className="csc-security-title">
                <Lock className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                Enterprise-grade protection
              </h2>
              <p className="csc-security-desc">
                Your agent is protected 24/7 with policy checks, risk scoring, and audit logs.
              </p>
              <ul className="csc-security-badges">
                {SECURITY_BADGES.map((badge) => (
                  <li key={badge}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                    {badge}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
