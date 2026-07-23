import { PRODUCT_NAME } from "./public-branding";

export const BUILDER_LOGOS = [
  "AgentForge",
  "SynthOps",
  "RunLayer",
  "ToolMesh",
  "Guardrail AI",
  "FlowPilot",
];

export const PROBLEMS = [
  {
    title: "Agents execute before anyone sees the action",
    description:
      "Autonomous tools can mutate production data, access secrets, and change permissions with no deterministic gate between intent and execution.",
  },
  {
    title: "Policy and risk live in different systems",
    description:
      "Security rules sit in one place, ML signals in another, and human review in a third — making consistent decisions slow and error-prone.",
  },
  {
    title: "Audit trails break at execution time",
    description:
      "Without binding approval to a one-time execution token, teams cannot prove who authorized what ran, when, and with which payload.",
  },
];

export const GATEWAY_FLOW = [
  {
    step: "01",
    title: "Propose",
    description: "Your agent sends tool intent, payload, and context to the gateway before running anything.",
    status: "pending",
  },
  {
    step: "02",
    title: "Policy Engine",
    description: "Deterministic rules evaluate action type, scope, and org policy — allow, block, or route to review.",
    status: "policy",
  },
  {
    step: "03",
    title: "Hybrid Risk Classifier",
    description: "Shadow or hybrid ML analysis scores severity and confidence without blocking the deterministic path.",
    status: "risk",
  },
  {
    step: "04",
    title: "Human Review",
    description: "Reviewers approve, reject, or escalate with SLA deadlines and notification routing.",
    status: "review",
  },
  {
    step: "05",
    title: "Execution Token",
    description: "A single-use token binds the approved payload hash — replay and tampering are rejected at verify time.",
    status: "token",
  },
  {
    step: "06",
    title: "Verify & Execute",
    description: "The agent verifies the token against the exact action, then executes with a full immutable audit record.",
    status: "execute",
  },
];

export const FEATURES = [
  {
    title: "Policy Engine",
    description:
      "Deterministic allow, block, and review rules keyed on action type, agent identity, and org-scoped policy configuration.",
    icon: "policy",
  },
  {
    title: "Hybrid AI Risk Classifier",
    description:
      "Shadow, hybrid, or enforce modes combine ML severity signals with policy outcomes — escalate high-confidence risks to human review.",
    icon: "risk",
  },
  {
    title: "Human Review",
    description:
      "Structured review queues with approve, reject, escalate, timeout handling, and reviewer notifications.",
    icon: "review",
  },
  {
    title: "Audit Logs",
    description:
      "Every proposal, policy decision, risk signal, human verdict, and execution attempt is recorded for compliance and forensics.",
    icon: "audit",
  },
  {
    title: "Execution Tokens",
    description:
      "One-time, payload-bound tokens issued only after approval — consumed on successful verify to prevent replay.",
    icon: "token",
  },
  {
    title: "Notifications",
    description:
      "Email and in-app alerts when review is required, with deduplicated delivery and gateway event tracking.",
    icon: "notify",
  },
];

export const ARCHITECTURE_NODES = [
  { id: "agent", label: "AI Agent", sub: "SDK / HTTP" },
  { id: "gateway", label: "Gateway API", sub: "Propose · Status · Verify" },
  { id: "policy", label: "Policy Engine", sub: "Deterministic rules" },
  { id: "risk", label: "Risk Classifier", sub: "Shadow / Hybrid / Enforce" },
  { id: "review", label: "Review Service", sub: "Human decisions" },
  { id: "tokens", label: "Token Store", sub: "Single-use issuance" },
  { id: "audit", label: "Audit Log", sub: "Immutable events" },
  { id: "notify", label: "Notifications", sub: "Email & alerts" },
];

export const FAQ_ITEMS = [
  {
    q: `How does ${PRODUCT_NAME} sit in my agent stack?`,
    a: "Agents call the gateway before executing a tool. Propose returns allow, block, or review_required. After approval, agents fetch an execution token and verify it immediately before running the action.",
  },
  {
    q: "What is hybrid risk enforcement?",
    a: "Hybrid mode keeps deterministic policy as the source of truth. ML can escalate an otherwise-allowed action to human review when severity is high or critical and model confidence meets your configured threshold.",
  },
  {
    q: "Are execution tokens replay-safe?",
    a: "Yes. Tokens are bound to the proposal payload hash, issued once after approval, and consumed on successful verify. Mismatched payloads or reused tokens are rejected.",
  },
  {
    q: "Can I start in shadow mode?",
    a: "Yes. Shadow mode runs risk analysis without changing policy outcomes — ideal for observing classifier behavior before enabling hybrid or enforce modes.",
  },
  {
    q: "What's included in the Free plan?",
    a: "1,000 API calls per month, 500 MB storage, 3 users, basic risk scoring, and email notifications. Upgrade for advanced classifier modes, audit analytics, and higher limits.",
  },
  {
    q: "Do you offer self-hosted deployment?",
    a: "Team plans include dedicated deployment options. Contact us for architecture review and air-gapped requirements.",
  },
];
