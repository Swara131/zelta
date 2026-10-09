"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createStructuredRuleId,
  formatStructuredDecision,
  loadStructuredProtectionRules,
  saveStructuredProtectionRules,
  structuredDecisionClass,
  type StructuredProtectionConfig,
  type StructuredProtectionDecision,
  type StructuredProtectionRule,
} from "@/lib/protection/structured-rules";
import { showTrustToastByKey } from "@/lib/trust/dashboard-trust";

const DECISION_OPTIONS: Array<{ value: StructuredProtectionDecision; label: string }> = [
  { value: "ALLOW", label: "ALLOW — Automatic" },
  { value: "REVIEW", label: "APPROVAL — Human review" },
  { value: "BLOCK", label: "BLOCK — Never allowed" },
];

interface EditDraft {
  action: string;
  condition: string;
  explanation: string;
  decision: StructuredProtectionDecision;
}

const EMPTY_DRAFT: EditDraft = {
  action: "",
  condition: "",
  explanation: "",
  decision: "REVIEW",
};

interface ProtectionRulesTableProps {
  onSaved?: () => void;
}

export default function ProtectionRulesTable({ onSaved }: ProtectionRulesTableProps) {
  const [config, setConfig] = useState<StructuredProtectionConfig | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadStructuredProtectionRules());
  }, []);

  if (!config) {
    return null;
  }

  const updateRules = (updater: (rules: StructuredProtectionRule[]) => StructuredProtectionRule[]) => {
    setConfig((current) => {
      if (!current) return current;
      return { rules: updater(current.rules) };
    });
    setSavedMessage(null);
  };

  const startEdit = (rule: StructuredProtectionRule) => {
    setEditingId(rule.id);
    setEditDraft({
      action: rule.action,
      condition: rule.condition,
      explanation: rule.explanation,
      decision: rule.decision,
    });
    setAdding(false);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmedAction = editDraft.action.trim();
    const trimmedCondition = editDraft.condition.trim();
    const trimmedExplanation = editDraft.explanation.trim();
    if (!trimmedAction || !trimmedCondition || !trimmedExplanation) {
      return;
    }

    updateRules((rules) =>
      rules.map((rule) =>
        rule.id === editingId
          ? {
              ...rule,
              action: trimmedAction,
              condition: trimmedCondition,
              explanation: trimmedExplanation,
              decision: editDraft.decision,
            }
          : rule
      )
    );
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  };

  const removeRule = (ruleId: string) => {
    updateRules((rules) => rules.filter((rule) => rule.id !== ruleId));
    if (editingId === ruleId) {
      cancelEdit();
    }
  };

  const startAdd = () => {
    setAdding(true);
    setAddDraft(EMPTY_DRAFT);
    cancelEdit();
  };

  const commitAdd = () => {
    const trimmedAction = addDraft.action.trim();
    const trimmedCondition = addDraft.condition.trim();
    const trimmedExplanation = addDraft.explanation.trim();
    if (!trimmedAction || !trimmedCondition || !trimmedExplanation) {
      return;
    }

    updateRules((rules) => [
      ...rules,
      {
        id: createStructuredRuleId(),
        action: trimmedAction,
        condition: trimmedCondition,
        explanation: trimmedExplanation,
        decision: addDraft.decision,
      },
    ]);
    setAdding(false);
    setAddDraft(EMPTY_DRAFT);
  };

  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(EMPTY_DRAFT);
  };

  const handleSave = () => {
    setSaving(true);
    saveStructuredProtectionRules(config);
    setSaving(false);
    setSavedMessage(null);
    showTrustToastByKey("rulesSaved");
    onSaved?.();
  };

  const renderDraftFields = (
    draft: EditDraft,
    onChange: (next: EditDraft) => void,
    idPrefix: string
  ) => (
    <div className="prot-rules-draft">
      <label className="prot-rules-draft-field">
        <span className="prot-rules-draft-label">Action</span>
        <input
          id={`${idPrefix}-action`}
          className="ds-input w-full"
          value={draft.action}
          onChange={(event) => onChange({ ...draft, action: event.target.value })}
          placeholder="e.g. Refund customer"
        />
      </label>
      <label className="prot-rules-draft-field">
        <span className="prot-rules-draft-label">Condition</span>
        <input
          id={`${idPrefix}-condition`}
          className="ds-input w-full"
          value={draft.condition}
          onChange={(event) => onChange({ ...draft, condition: event.target.value })}
          placeholder="e.g. Above ₹5,000"
        />
      </label>
      <label className="prot-rules-draft-field prot-rules-draft-wide">
        <span className="prot-rules-draft-label">Explanation</span>
        <input
          id={`${idPrefix}-explanation`}
          className="ds-input w-full"
          value={draft.explanation}
          onChange={(event) => onChange({ ...draft, explanation: event.target.value })}
          placeholder="What this rule controls, in plain English"
        />
      </label>
      <label className="prot-rules-draft-field">
        <span className="prot-rules-draft-label">Protection</span>
        <select
          id={`${idPrefix}-decision`}
          className="ds-input w-full"
          value={draft.decision}
          onChange={(event) =>
            onChange({ ...draft, decision: event.target.value as StructuredProtectionDecision })
          }
        >
          {DECISION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <section className="prot-rules-section" aria-labelledby="prot-rules-heading">
      <header className="prot-rules-header">
        <div>
          <h2 id="prot-rules-heading" className="prot-section-title">
            Your protection rules
          </h2>
          <p className="prot-section-desc">
            Each rule tells Wave what to do when your agent tries a specific action. Edit them to
            match how you want your business protected.
          </p>
        </div>
        <button type="button" className="ds-btn ds-btn-secondary" onClick={startAdd}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Add protection rule
        </button>
      </header>

      <div className="prot-rules-table-wrap ds-panel">
        <table className="prot-rules-table">
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Condition</th>
              <th scope="col">What Wave does</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {config.rules.map((rule) => {
              const editing = editingId === rule.id;

              if (editing) {
                return (
                  <tr key={rule.id} className="prot-rules-row-editing">
                    <td colSpan={4}>
                      {renderDraftFields(editDraft, setEditDraft, `edit-${rule.id}`)}
                      <div className="prot-rules-row-actions">
                        <button
                          type="button"
                          className="ds-btn ds-btn-primary"
                          onClick={commitEdit}
                        >
                          <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                          Save
                        </button>
                        <button
                          type="button"
                          className="ds-btn ds-btn-secondary"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={rule.id}>
                  <td data-label="Action">
                    <span className="prot-rules-action">{rule.action}</span>
                  </td>
                  <td data-label="Condition">
                    <span className="prot-rules-condition">{rule.condition}</span>
                  </td>
                  <td data-label="What Wave does">
                    <div className="prot-rules-outcome">
                      <span
                        className={`prot-rule-decision ${structuredDecisionClass(rule.decision)}`}
                      >
                        {formatStructuredDecision(rule.decision)}
                      </span>
                      <p className="prot-rules-explanation">{rule.explanation}</p>
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div className="prot-rules-actions">
                      <button
                        type="button"
                        className="pr-rule-action"
                        onClick={() => startEdit(rule)}
                        aria-label={`Edit rule for ${rule.action}`}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="pr-rule-action pr-rule-action-delete"
                        onClick={() => removeRule(rule.id)}
                        aria-label={`Delete rule for ${rule.action}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="prot-rules-add ds-panel">
          <h3 className="prot-rules-add-title">New protection rule</h3>
          <p className="prot-rules-add-desc">
            Describe what action you want to control, when it applies, and what Wave should do.
          </p>
          {renderDraftFields(addDraft, setAddDraft, "add")}
          <div className="prot-rules-row-actions">
            <button
              type="button"
              className="ds-btn ds-btn-primary"
              onClick={commitAdd}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Add rule
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={cancelAdd}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="pr-save-bar">
        <button
          type="button"
          className="ds-btn ds-btn-primary pr-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Protection Rules"}
        </button>
        {savedMessage ? (
          <p className="pr-save-message" role="status">
            {savedMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
