"use client";

import type { DecisionAgentRecord, GeneratedDecisionAgentPreview } from "@/lib/decision-agents/types";

type PreviewSource = GeneratedDecisionAgentPreview | DecisionAgentRecord;

interface DecisionAgentPreviewCardProps {
  preview: PreviewSource;
  savedSlug?: string | null;
  onTest: () => void;
  onDeploy: () => void;
  onEdit: () => void;
  onSave: () => void;
  saving?: boolean;
  deploying?: boolean;
  deployMessage?: string | null;
  saveError?: string | null;
}

function getRiskLevel(source: PreviewSource): string {
  return source.config.riskLevel ?? ("riskLevel" in source ? source.riskLevel : "medium");
}

function getApprovalLevel(source: PreviewSource): string {
  return source.config.approvalLevel ?? ("approvalLevel" in source ? source.approvalLevel : source.config.approvalWhen);
}

export default function DecisionAgentPreviewCard({
  preview,
  savedSlug,
  onTest,
  onDeploy,
  onEdit,
  onSave,
  saving = false,
  deploying = false,
  deployMessage,
  saveError,
}: DecisionAgentPreviewCardProps) {
  const outcomes = preview.config.possibleOutcomes ?? ["allow", "review", "block"];
  const status = "status" in preview && preview.status ? preview.status : "draft";

  return (
    <article className="zdec-preview ds-panel">
      <header className="zdec-preview-header">
        <h2>{preview.name}</h2>
        <span className={`zdec-status-badge zdec-status-${status}`}>{status}</span>
      </header>

      <dl className="zdec-preview-grid">
        <div>
          <dt>Decision objective</dt>
          <dd>{preview.purpose}</dd>
        </div>
        <div>
          <dt>Decision logic</dt>
          <dd>
            <ul className="zdec-rules-compact">
              {preview.config.rules.map((rule) => (
                <li key={rule.id}>
                  {rule.label} → {rule.outcome.toUpperCase()}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Possible decisions</dt>
          <dd className="zdec-outcomes">
            {outcomes.map((outcome) => (
              <span key={outcome}>{outcome.toUpperCase()}</span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Risk level</dt>
          <dd>{getRiskLevel(preview)}</dd>
        </div>
        <div>
          <dt>Approval requirement</dt>
          <dd>{getApprovalLevel(preview)}</dd>
        </div>
      </dl>

      {saveError ? <p className="zplat-error" role="alert">{saveError}</p> : null}
      {deployMessage ? <p className="zplat-result-pass">{deployMessage}</p> : null}

      <div className="zdec-preview-actions">
        <button type="button" className="zplat-btn zplat-btn-secondary" onClick={onTest}>
          Test Agent
        </button>
        <button
          type="button"
          className="zplat-btn zplat-btn-secondary"
          disabled={!savedSlug || deploying || status === "deployed"}
          onClick={onDeploy}
        >
          {deploying ? "Deploying…" : "Deploy Agent"}
        </button>
        <button type="button" className="zplat-btn zplat-btn-ghost" onClick={onEdit}>
          Edit Agent
        </button>
        <button
          type="button"
          className="zplat-btn zplat-btn-primary"
          disabled={Boolean(savedSlug) || saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : savedSlug ? "Saved" : "Save Agent"}
        </button>
      </div>
    </article>
  );
}
