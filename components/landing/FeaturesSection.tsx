"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  History,
  Link2,
  Shield,
  Sparkles,
  AlertTriangle,
  ScrollText,
} from "lucide-react";
import SectionHeading from "./SectionHeading";

const PROTECTION_FLOW = [
  {
    step: "1",
    label: "Agent wants to act",
    example: "Refund ₹50,000 to a customer",
    body: "Your AI agent proposes an action.",
    icon: Bot,
  },
  {
    step: "2",
    label: "Wave checks it",
    example: "Policy + Risk Check",
    body: "Wave checks your rules, the agent, the action and its risk.",
    icon: Shield,
  },
  {
    step: "3",
    label: "Wave decides",
    example: "ALLOW · REVIEW · BLOCK",
    body: "Safe actions continue automatically. Risky actions can require human approval. Dangerous actions are blocked.",
    icon: Sparkles,
  },
  {
    step: "4",
    label: "Action executes",
    example: "Only if approved",
    body: "Only approved actions are allowed to continue.",
    icon: CheckCircle2,
  },
] as const;

const OUTCOMES = [
  {
    key: "allow",
    emoji: "🟢",
    title: "Allow",
    body: "Safe actions that match your policies can run automatically.",
    className: "lf-outcome-allow",
  },
  {
    key: "review",
    emoji: "🟡",
    title: "Review",
    body: "Risky or sensitive actions are sent to a human for approval.",
    className: "lf-outcome-review",
  },
  {
    key: "block",
    emoji: "🔴",
    title: "Block",
    body: "Actions that violate your policies are stopped before execution.",
    className: "lf-outcome-block",
  },
] as const;

const VISIBILITY_CARDS = [
  {
    title: "Agents",
    body: "See and manage the AI agents connected to Wave.",
    href: "/integrations",
    icon: Bot,
  },
  {
    title: "Approvals",
    body: "Review actions that need human approval.",
    href: "/approvals",
    icon: ClipboardCheck,
  },
  {
    title: "Activity",
    body: "See what your agents attempted and what Wave decided.",
    href: "/audit",
    icon: History,
  },
  {
    title: "Audit Logs",
    body: "Keep a record of decisions, approvals and execution attempts.",
    href: "/audit",
    icon: ScrollText,
  },
] as const;

export default function FeaturesSection() {
  const [technicalOpen, setTechnicalOpen] = useState(false);

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section 1 — intro + primary actions */}
        <SectionHeading
          eyebrow="What you can do with Wave"
          title="Connect your AI agent. Let Wave protect its actions."
          description="Wave sits between your AI agent and the actions it wants to perform. Every important action is checked before execution."
          accent="indigo"
        />

        <div className="lf-primary-cards">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lf-primary-card lf-primary-card-create"
          >
            <span className="lf-primary-emoji" aria-hidden="true">
              ✨
            </span>
            <h3 className="lf-primary-title">Create an AI Agent</h3>
            <p className="lf-primary-desc">
              Build and configure an AI agent inside Wave.
            </p>
            <Link href="/agents/build" className="landing-cta-primary lf-primary-btn group">
              Create Agent
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </Link>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="lf-primary-card lf-primary-card-connect"
          >
            <span className="lf-primary-emoji" aria-hidden="true">
              🔗
            </span>
            <h3 className="lf-primary-title">Connect an Existing Agent</h3>
            <p className="lf-primary-desc">
              Already have an AI agent? Connect it to Wave and protect its actions.
            </p>
            <Link href="/onboarding/connect" className="lf-secondary-btn group">
              Connect Agent
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </Link>
          </motion.article>
        </div>

        {/* Section 2 — protection flow */}
        <div className="lf-block mt-24 sm:mt-32">
          <SectionHeading
            eyebrow="What happens after you connect"
            title="Wave protects every important action"
            description="When your agent wants to perform an action, Wave checks it before anything happens."
            accent="violet"
          />

          <div className="lf-flow">
            {PROTECTION_FLOW.map(({ step, label, example, body, icon: Icon }, index) => (
              <div key={step} className="lf-flow-step-wrap">
                <motion.article
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="lf-flow-step landing-feature-card"
                >
                  <div className="lf-flow-step-head">
                    <span className="lf-flow-step-num">{step}</span>
                    <div className="lf-flow-step-icon">
                      <Icon className="h-5 w-5 text-indigo-300" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                  </div>
                  <p className="lf-flow-step-label">{label}</p>
                  <p className="lf-flow-step-example">&ldquo;{example}&rdquo;</p>
                  <p className="lf-flow-step-body">{body}</p>
                </motion.article>
                {index < PROTECTION_FLOW.length - 1 ? (
                  <ArrowDown className="lf-flow-arrow" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 — real examples */}
        <div className="lf-block mt-24 sm:mt-32">
          <SectionHeading
            eyebrow="Real example"
            title="See how Wave protects an AI agent"
            accent="cyan"
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.article
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lf-example-card landing-glass-panel"
            >
              <p className="lf-example-agent">
                <Bot className="h-4 w-4 shrink-0 text-indigo-300" strokeWidth={2} aria-hidden="true" />
                Customer Support Agent
              </p>
              <p className="lf-example-wants">
                Agent wants to: <strong>Refund ₹50,000</strong>
              </p>

              <dl className="lf-example-rows">
                <div className="lf-example-row">
                  <dt>Action</dt>
                  <dd>Issue customer refund</dd>
                </div>
                <div className="lf-example-row">
                  <dt>Policy</dt>
                  <dd>Human approval required above ₹10,000</dd>
                </div>
                <div className="lf-example-row">
                  <dt>Risk</dt>
                  <dd className="lf-example-risk-high">High</dd>
                </div>
                <div className="lf-example-row lf-example-row-decision">
                  <dt>Wave decision</dt>
                  <dd>
                    <span className="lf-decision-badge lf-decision-review">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Review required
                    </span>
                  </dd>
                </div>
              </dl>

              <Link href="/approvals" className="landing-cta-primary lf-example-cta group">
                Approve or Reject
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </Link>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="lf-example-card lf-example-card-small landing-feature-card"
            >
              <p className="lf-example-wants">
                Action: <strong>Send customer order-status email</strong>
              </p>
              <dl className="lf-example-rows mt-4">
                <div className="lf-example-row">
                  <dt>Risk</dt>
                  <dd className="lf-example-risk-low">Low</dd>
                </div>
                <div className="lf-example-row lf-example-row-decision">
                  <dt>Decision</dt>
                  <dd>
                    <span className="lf-decision-badge lf-decision-allow">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Allowed
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="lf-example-note mt-4">
                Safe, routine actions like this can run automatically — no approval needed.
              </p>
            </motion.article>
          </div>
        </div>

        {/* Section 4 — three outcomes */}
        <div className="lf-block mt-24 sm:mt-32">
          <SectionHeading
            eyebrow="Simple decisions"
            title="Every action gets a clear decision"
            accent="emerald"
          />

          <div className="lf-outcomes-grid">
            {OUTCOMES.map(({ key, emoji, title, body, className }, index) => (
              <motion.article
                key={key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className={`lf-outcome-card landing-feature-card ${className}`}
              >
                <span className="lf-outcome-emoji" aria-hidden="true">
                  {emoji}
                </span>
                <h3 className="lf-outcome-title">{title}</h3>
                <p className="lf-outcome-body">{body}</p>
              </motion.article>
            ))}
          </div>
        </div>

        {/* Section 5 — visibility */}
        <div className="lf-block mt-24 sm:mt-32">
          <SectionHeading
            eyebrow="Visibility"
            title="Everything is visible in one place"
            accent="indigo"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {VISIBILITY_CARDS.map(({ title, body, href, icon: Icon }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="lf-visibility-card landing-feature-card group"
              >
                <div className="lf-visibility-icon">
                  <Icon className="h-5 w-5 text-indigo-300" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h3 className="lf-visibility-title">{title}</h3>
                <p className="lf-visibility-body">{body}</p>
                <Link href={href} className="lf-visibility-link group/link">
                  View
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>

        {/* Section 6 — bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="lf-bottom-cta landing-cta-section relative mt-24 overflow-hidden rounded-3xl px-6 py-14 text-center sm:mt-32 sm:px-12 sm:py-16"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-blue-600/10"
            aria-hidden="true"
          />
          <div className="absolute inset-0 backdrop-blur-3xl" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Ready to protect your AI agent?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              Create a new agent or connect an existing one and let Wave control its actions.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/agents/build" className="landing-cta-primary group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                Create an Agent
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/onboarding/connect"
                className="lf-secondary-btn lf-secondary-btn-light group inline-flex rounded-full px-7 py-3.5"
              >
                <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Connect Existing Agent
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Optional technical details — not primary */}
        <div className="mt-12">
          <button
            type="button"
            className="lf-technical-toggle"
            aria-expanded={technicalOpen}
            onClick={() => setTechnicalOpen((open) => !open)}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${technicalOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
              aria-hidden="true"
            />
            Technical details
            <span className="text-zinc-600">For developers</span>
          </button>
          {technicalOpen ? (
            <div className="lf-technical-panel landing-feature-card mt-3 p-5 text-sm leading-relaxed text-zinc-500">
              <p>
                Under the hood, Wave uses policy evaluation, risk scoring, human review queues,
                audit trails, and one-time execution credentials. These power the simple Allow /
                Review / Block experience above — you don&apos;t need to configure them to get
                started.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
