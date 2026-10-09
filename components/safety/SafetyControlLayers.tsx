"use client";

import { useState } from "react";
import StatusBadge from "@/components/ui/StatusBadge";

const LAYERS = [
  {
    id: "content",
    title: "Content safety",
    status: "Enabled",
    tone: "success" as const,
    detail: "Blocks disallowed content before the agent continues.",
  },
  {
    id: "pii",
    title: "PII detection",
    status: "Protected",
    tone: "success" as const,
    detail: "Flags personal data in prompts, tools, and outbound messages.",
  },
  {
    id: "injection",
    title: "Prompt injection / jailbreak",
    status: "Enabled",
    tone: "success" as const,
    detail: "Detects attempts to override instructions or bypass safety.",
  },
  {
    id: "tools",
    title: "Tool permissions",
    status: "Protected",
    tone: "success" as const,
    detail: "Agents can only use tools you have allowed for their mission.",
  },
  {
    id: "policy",
    title: "Policy checks",
    status: "Enabled",
    tone: "success" as const,
    detail: "Business rules run on every high-impact action.",
  },
  {
    id: "risk",
    title: "Risk classification",
    status: "Enabled",
    tone: "success" as const,
    detail: "Each action is scored so you can see why Wave paused it.",
  },
  {
    id: "approval",
    title: "Approval requirements",
    status: "Enabled",
    tone: "success" as const,
    detail: "Risky actions wait until you approve or deny them.",
  },
  {
    id: "audit",
    title: "Audit logs",
    status: "Enabled",
    tone: "success" as const,
    detail: "Every decision is recorded for later review.",
  },
];

export default function SafetyControlLayers() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="sc-layers" aria-label="Protection status">
      <h2 className="sc-section-title">Protection status</h2>
      <ul className="sc-layer-grid">
        {LAYERS.map((layer) => (
          <li key={layer.id}>
            <button
              type="button"
              className="sc-layer-card"
              aria-expanded={openId === layer.id}
              onClick={() => setOpenId((current) => (current === layer.id ? null : layer.id))}
            >
              <span>{layer.title}</span>
              <StatusBadge tone={layer.tone}>{layer.status}</StatusBadge>
            </button>
            {openId === layer.id ? <p className="sc-layer-detail">{layer.detail}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
