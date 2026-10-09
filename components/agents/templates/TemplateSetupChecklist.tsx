"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const STEPS = [
  "Name your agent",
  "Connect tools",
  "Review permissions",
  "Review approval rules",
  "Test safely",
  "Activate agent",
];

export default function TemplateSetupChecklist() {
  const params = useParams();
  const agentId = typeof params.agentId === "string" ? params.agentId : "";
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const markReviewed = async () => {
    if (!agentId) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/v1/agents/${encodeURIComponent(agentId)}/template-permissions-review`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Could not save review.");
      }
      setReviewed(true);
      setMessage("Permissions review saved. You can activate this agent when you are ready.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ztpl-checklist ds-panel" aria-labelledby="ztpl-checklist-heading">
      <h2 id="ztpl-checklist-heading">Template setup</h2>
      <ol>
        {STEPS.map((step, index) => (
          <li key={step}>
            {index + 1}. {step}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="ds-btn ds-btn-secondary"
        disabled={saving || reviewed}
        onClick={() => void markReviewed()}
      >
        {reviewed ? "Permissions reviewed" : saving ? "Saving…" : "I reviewed permissions and approval rules"}
      </button>
      {message ? <p className="ztpl-checklist-msg">{message}</p> : null}
    </section>
  );
}
