import type { LucideIcon } from "lucide-react";
import {
  Upload,
  Languages,
  ShieldAlert,
  CheckCircle2,
  Mail,
  History,
  BarChart3,
} from "lucide-react";

export interface PipelineMetric {
  label: string;
  value: string;
}

export interface PipelineStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  glowColor: string;
  href?: string;
  status: "active" | "idle" | "complete";
  metrics: PipelineMetric[];
  features: string[];
  techStack: string[];
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "upload",
    title: "Upload Logs",
    subtitle: "Ingestion Layer",
    description:
      "Secure entry point for agent action logs. Supports drag-and-drop upload of CSV, TXT, JSON, and LOG files with automatic format detection, checksum validation, and metadata extraction.",
    icon: Upload,
    gradient: "from-blue-600 via-cyan-500 to-teal-400",
    glowColor: "rgba(34, 211, 238, 0.4)",
    href: "/",
    status: "complete",
    metrics: [
      { label: "Files Processed", value: "1,284" },
      { label: "Avg. Upload Time", value: "1.2s" },
      { label: "Success Rate", value: "99.7%" },
    ],
    features: [
      "Drag & drop multi-format ingestion",
      "Automatic schema validation",
      "Duplicate detection via SHA-256",
      "Sample file generation for testing",
    ],
    techStack: ["Next.js API Routes", "S3-compatible storage", "ClamAV scanning"],
  },
  {
    id: "translator",
    title: "AI Translator",
    subtitle: "Natural Language Engine",
    description:
      "Converts raw technical log entries into plain-English business narratives. Uses fine-tuned LLM with domain-specific agent action vocabulary to produce human-readable explanations with confidence scores.",
    icon: Languages,
    gradient: "from-violet-600 via-purple-500 to-fuchsia-400",
    glowColor: "rgba(167, 139, 250, 0.4)",
    href: "/translator",
    status: "complete",
    metrics: [
      { label: "Entries Translated", value: "8,942" },
      { label: "Avg. Confidence", value: "96.2%" },
      { label: "Languages", value: "EN" },
    ],
    features: [
      "Syntax-highlighted log preview",
      "Typewriter streaming output",
      "Per-action business context",
      "Copy & export translations",
    ],
    techStack: ["GPT-4o fine-tuned", "LangChain", "Vector embeddings"],
  },
  {
    id: "classifier",
    title: "Risk Classifier",
    subtitle: "Threat Intelligence",
    description:
      "ML-powered risk scoring engine that maps translated actions to severity levels. Correlates events with MITRE ATT&CK techniques, OWASP categories, and compliance frameworks to produce actionable risk findings.",
    icon: ShieldAlert,
    gradient: "from-orange-600 via-red-500 to-rose-400",
    glowColor: "rgba(251, 113, 133, 0.4)",
    href: "/risk",
    status: "active",
    metrics: [
      { label: "Risks Detected", value: "347" },
      { label: "Critical Findings", value: "28" },
      { label: "MITRE Mappings", value: "142" },
    ],
    features: [
      "Real-time severity classification",
      "MITRE ATT&CK & OWASP mapping",
      "Compliance impact assessment",
      "7-day risk trend analytics",
    ],
    techStack: ["XGBoost classifier", "MITRE ATT&CK API", "Custom rule engine"],
  },
  {
    id: "approval",
    title: "Approval Engine",
    subtitle: "Governance Workflow",
    description:
      "Policy-driven approval orchestrator that routes high-risk actions through human review chains. Configurable rules based on severity, affected systems, and business impact determine auto-approve vs. manual review paths.",
    icon: CheckCircle2,
    gradient: "from-emerald-600 via-green-500 to-lime-400",
    glowColor: "rgba(52, 211, 153, 0.4)",
    status: "idle",
    metrics: [
      { label: "Pending Reviews", value: "12" },
      { label: "Avg. Resolution", value: "4.2h" },
      { label: "Auto-approved", value: "78%" },
    ],
    features: [
      "Multi-tier approval chains",
      "SLA tracking & escalation",
      "Role-based routing (RBAC)",
      "Break-glass emergency override",
    ],
    techStack: ["Temporal workflows", "OPA policy engine", "Webhook integrations"],
  },
  {
    id: "email",
    title: "Email Notification",
    subtitle: "Alert Dispatch",
    description:
      "Delivers contextual email alerts to stakeholders when risks require attention or approvals are pending. Templates include severity badges, AI recommendations, and one-click approve/deny actions.",
    icon: Mail,
    gradient: "from-indigo-600 via-blue-500 to-sky-400",
    glowColor: "rgba(96, 165, 250, 0.4)",
    status: "idle",
    metrics: [
      { label: "Emails Sent", value: "2,156" },
      { label: "Open Rate", value: "94.1%" },
      { label: "Response Time", value: "23m" },
    ],
    features: [
      "Severity-based routing rules",
      "Rich HTML alert templates",
      "One-click inline actions",
      "Digest & escalation modes",
    ],
    techStack: ["SendGrid", "React Email", "MJML templates"],
  },
  {
    id: "audit",
    title: "Audit Timeline",
    subtitle: "Immutable Record",
    description:
      "Append-only audit trail capturing every pipeline event from upload through final disposition. Cryptographically signed entries ensure tamper-evidence for compliance audits and forensic investigations.",
    icon: History,
    gradient: "from-amber-600 via-yellow-500 to-orange-400",
    glowColor: "rgba(251, 191, 36, 0.35)",
    status: "idle",
    metrics: [
      { label: "Events Logged", value: "48,291" },
      { label: "Retention", value: "7 years" },
      { label: "Integrity", value: "100%" },
    ],
    features: [
      "Hash-chained event log",
      "Full pipeline replay",
      "Compliance export (SOC 2)",
      "Real-time event streaming",
    ],
    techStack: ["PostgreSQL WAL", "SHA-256 chain", "Event sourcing"],
  },
  {
    id: "analytics",
    title: "Analytics",
    subtitle: "Insights Dashboard",
    description:
      "Executive and operational dashboards aggregating pipeline metrics, risk trends, approval velocity, and agent behavior patterns. Powers data-driven security posture decisions.",
    icon: BarChart3,
    gradient: "from-pink-600 via-rose-500 to-red-400",
    glowColor: "rgba(244, 114, 182, 0.35)",
    status: "idle",
    metrics: [
      { label: "Dashboards", value: "8" },
      { label: "Reports Generated", value: "156" },
      { label: "Data Points", value: "1.2M" },
    ],
    features: [
      "Risk trend visualization",
      "Agent behavior heatmaps",
      "Approval SLA reporting",
      "Scheduled PDF exports",
    ],
    techStack: ["Recharts", "ClickHouse", "Metabase embed"],
  },
];

export const PIPELINE_STATS = {
  totalRuns: 1284,
  avgDuration: "2m 34s",
  successRate: "99.2%",
  activeNow: 3,
};
