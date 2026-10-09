"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  loadAgentProtectionSettings,
  saveAgentProtectionSettings,
} from "@/lib/agent-builder/agent-protection-settings";
import { markAgentProtectionConfigured } from "@/lib/agent-builder/agent-onboarding";

interface ConfigureProtectionStepModalProps {
  open: boolean;
  agentId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ConfigureProtectionStepModal({
  open,
  agentId,
  onClose,
  onSaved,
}: ConfigureProtectionStepModalProps) {
  const [thresholdInr, setThresholdInr] = useState(5_000);
  const [autoAllowLowRisk, setAutoAllowLowRisk] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const settings = loadAgentProtectionSettings(agentId);
    setThresholdInr(settings.thresholdInr);
    setAutoAllowLowRisk(settings.autoAllowLowRisk);
  }, [open, agentId]);

  const handleSave = () => {
    setSaving(true);
    saveAgentProtectionSettings(agentId, {
      thresholdInr,
      autoAllowLowRisk,
    });
    markAgentProtectionConfigured(agentId);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure protection"
      variant="slideout"
      size="md"
    >
      <p className="asp-modal-desc">
        Set when your agent can act automatically and when Wave should ask you first.
      </p>

      <label className="asp-field">
        <span className="asp-label">
          Auto-approve refunds up to{" "}
          <strong>₹{thresholdInr.toLocaleString("en-IN")}</strong>
        </span>
        <input
          type="range"
          className="asp-slider"
          min={500}
          max={50000}
          step={500}
          value={thresholdInr}
          onChange={(event) => setThresholdInr(Number(event.target.value))}
        />
        <div className="asp-slider-labels">
          <span>₹500</span>
          <span>₹50,000</span>
        </div>
      </label>

      <label className="asp-check">
        <input
          type="checkbox"
          checked={autoAllowLowRisk}
          onChange={(event) => setAutoAllowLowRisk(event.target.checked)}
        />
        <span>Auto-allow low-risk actions</span>
      </label>

      <p className="asp-hint">
        Refunds above ₹{thresholdInr.toLocaleString("en-IN")} will require your approval before
        they run.
      </p>

      <div className="asp-actions">
        <Button variant="primary" loading={saving} onClick={handleSave}>
          Save protection
        </Button>
        <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
