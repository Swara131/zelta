export const COMPANY_LOGOS = [
  "Acme Corp",
  "Northwind",
  "Globex",
  "Initech",
  "Umbrella",
  "Stark Industries",
];

export const PROBLEMS = [
  {
    title: "AI agents act without oversight",
    description:
      "Autonomous agents execute privileged operations — database queries, secret access, permission grants — with no human in the loop.",
    stat: "73%",
    statLabel: "of orgs lack agent governance",
  },
  {
    title: "Logs are unreadable",
    description:
      "Technical agent logs are opaque to security teams and executives. Critical risks hide in JSON lines nobody can interpret.",
    stat: "4.2h",
    statLabel: "avg. time to triage an incident",
  },
  {
    title: "Compliance gaps widen",
    description:
      "SOC 2, GDPR, and PCI-DSS require documented approval chains. Ad-hoc agent actions create audit failures and regulatory exposure.",
    stat: "$4.8M",
    statLabel: "avg. breach cost",
  },
];

export const SOLUTIONS = [
  {
    title: "Instant plain-English translation",
    description: "AI converts technical agent logs into business-readable narratives with confidence scores.",
    icon: "translate",
  },
  {
    title: "Automated risk classification",
    description: "ML maps every action to MITRE ATT&CK, OWASP, and compliance frameworks in real time.",
    icon: "shield",
  },
  {
    title: "Human approval workflows",
    description: "Policy-driven gates route critical actions through the right reviewers with SLA tracking.",
    icon: "check",
  },
  {
    title: "Immutable audit trail",
    description: "Every decision cryptographically logged for SOC 2, ISO 27001, and forensic investigations.",
    icon: "audit",
  },
];

export const PIPELINE_STEPS = [
  { label: "Upload", desc: "Ingest logs" },
  { label: "Translate", desc: "AI plain English" },
  { label: "Risk Detection", desc: "ML classify" },
  { label: "Approval", desc: "Human review" },
  { label: "Audit", desc: "Immutable log" },
  { label: "Compliance", desc: "Report & export" },
];

export const FEATURES = [
  {
    title: "AI Translator",
    description: "Convert agent action logs to plain English with typewriter streaming and confidence scoring.",
    href: "/translator",
  },
  {
    title: "Risk Classifier",
    description: "MITRE ATT&CK mapping, OWASP categories, and compliance impact on every detected risk.",
    href: "/risk",
  },
  {
    title: "Approval Engine",
    description: "Multi-tier review chains with Approve, Reject, Escalate, and SLA enforcement.",
    href: "/approvals",
  },
  {
    title: "Analytics Dashboard",
    description: "Executive metrics, heatmaps, trends, and approval success rates at a glance.",
    href: "/analytics",
  },
  {
    title: "Integrations",
    description: "Connect Okta, AWS, Slack, Teams, Splunk, and 10+ enterprise platforms.",
    href: "/integrations",
  },
  {
    title: "Notifications",
    description: "Email, Slack, and Teams alerts with delivery tracking and retry logic.",
    href: "/notifications",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "ApprovalLayer cut our agent incident response time from hours to minutes. The AI translator alone saved our security team 20 hours a week.",
    author: "Sarah Chen",
    role: "CISO",
    company: "Northwind Financial",
    avatar: "SC",
  },
  {
    quote:
      "We passed our SOC 2 audit because every agent action now has a documented approval chain. This is the governance layer AI was missing.",
    author: "Marcus Webb",
    role: "VP Security",
    company: "Globex Systems",
    avatar: "MW",
  },
  {
    quote:
      "The risk classifier caught an unauthorized secrets access attempt our SIEM missed. ApprovalLayer is now mandatory for all production agents.",
    author: "Alex Rivera",
    role: "Head of DevOps",
    company: "Initech Labs",
    avatar: "AR",
  },
];

export const FAQ_ITEMS = [
  {
    q: "What log formats does ApprovalLayer support?",
    a: "CSV, TXT, JSON, and LOG files. We auto-detect schema and validate on upload. API ingestion is available on Professional and Enterprise plans.",
  },
  {
    q: "How does the AI Translator work?",
    a: "Our fine-tuned model converts technical agent actions into plain-English explanations with affected systems, users, business impact, and confidence scores.",
  },
  {
    q: "Can I integrate with our existing IdP?",
    a: "Yes. We support Google Workspace, Microsoft Entra ID, Okta, and SAML/SCIM on Enterprise. SSO is included in all paid plans.",
  },
  {
    q: "Is my data stored securely?",
    a: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Enterprise customers can choose dedicated VPC deployment.",
  },
  {
    q: "What's included in the Free plan?",
    a: "1,000 API calls/month, 500 MB storage, 3 users, basic risk scoring, and email notifications. Upgrade anytime for AI Translator and advanced features.",
  },
  {
    q: "Do you offer on-premise deployment?",
    a: "Enterprise plans include self-hosted and air-gapped deployment options. Contact sales for architecture review.",
  },
];
