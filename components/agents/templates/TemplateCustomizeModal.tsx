"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { AgentTemplate } from "@/lib/templates/types";

interface TemplateCustomizeModalProps {
  template: AgentTemplate | null;
  open: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    threshold?: number;
    needsApproval: boolean;
    customInstructions: string;
  }) => void;
}

export default function TemplateCustomizeModal({
  template,
  open,
  submitting,
  error,
  onClose,
  onSubmit,
}: TemplateCustomizeModalProps) {
  const [threshold, setThreshold] = useState("");
  const [needsApproval, setNeedsApproval] = useState(true);
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (!template || !open) return;
    setThreshold(String(template.defaultThreshold ?? 5000));
    setNeedsApproval(true);
    setCustomInstructions("");
  }, [template, open]);

  if (!template) return null;

  const handleSubmit = () => {
    const parsedThreshold = template.supportsThreshold
      ? Number.parseInt(threshold, 10)
      : undefined;

    if (template.supportsThreshold && (!parsedThreshold || parsedThreshold <= 0)) {
      return;
    }

    onSubmit({
      threshold: parsedThreshold,
      needsApproval,
      customInstructions: customInstructions.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Customize ${template.name}`}
      variant="center"
      size="lg"
      dismissible={!submitting}
      footer={
        <div className="ztpl-modal-footer">
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ds-btn ds-btn-primary"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              "Create from template"
            )}
          </button>
        </div>
      }
    >
      <div className="ztpl-modal-body">
        <div className="ztpl-modal-section">
          <p className="ztpl-modal-label">Template description</p>
          <p className="ztpl-modal-copy">
            This agent {template.summary.charAt(0).toLowerCase()}
            {template.summary.slice(1)}
          </p>
        </div>

        <div className="ztpl-modal-section">
          <p className="ztpl-modal-label">Customize for your business</p>

          {template.supportsThreshold ? (
            <label className="ztpl-field" htmlFor="ztpl-threshold">
              <span className="ztpl-field-label">
                {template.id === "template-7"
                  ? "What's your high-value order threshold (in rupees)?"
                  : "What's your refund threshold (in rupees)?"}
              </span>
              <input
                id="ztpl-threshold"
                type="number"
                min={1}
                step={1}
                className="ds-input ztpl-input"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                disabled={submitting}
              />
            </label>
          ) : null}

          <fieldset className="ztpl-toggle-field">
            <legend className="ztpl-field-label">Should this need approval?</legend>
            <div className="ztpl-toggle-group" role="group" aria-label="Needs approval">
              <button
                type="button"
                className={`ztpl-toggle-btn ${needsApproval ? "is-active" : ""}`}
                aria-pressed={needsApproval}
                disabled={submitting}
                onClick={() => setNeedsApproval(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`ztpl-toggle-btn ${!needsApproval ? "is-active" : ""}`}
                aria-pressed={!needsApproval}
                disabled={submitting}
                onClick={() => setNeedsApproval(false)}
              >
                No
              </button>
            </div>
          </fieldset>

          <label className="ztpl-field" htmlFor="ztpl-instructions">
            <span className="ztpl-field-label">Add custom instructions (optional)</span>
            <textarea
              id="ztpl-instructions"
              className="ds-input ztpl-textarea"
              rows={3}
              maxLength={500}
              placeholder="e.g., Only refund if customer has order history"
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value)}
              disabled={submitting}
            />
          </label>
        </div>

        {error ? (
          <p className="ztpl-modal-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
