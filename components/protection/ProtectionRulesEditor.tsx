"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { PROTECTION_EXPLANATION } from "@/lib/protection/plain-english";
import {
  createProtectionRuleId,
  loadProtectionRules,
  saveProtectionRules,
  type EditableProtectionConfig,
  type EditableProtectionRule,
  type ProtectionSection,
} from "@/lib/protection/protection-rules-store";
import { showTrustToastByKey } from "@/lib/trust/dashboard-trust";

const SECTIONS: Array<{
  key: ProtectionSection;
  title: string;
  description: string;
  className: string;
  positive: boolean;
}> = [
  {
    key: "allowed",
    title: "Allow automatically",
    description: "Actions the agent can perform without asking.",
    className: "pr-section-allow",
    positive: true,
  },
  {
    key: "askFirst",
    title: "Ask me first",
    description: "Actions Wave pauses and sends to the approval queue.",
    className: "pr-section-review",
    positive: true,
  },
  {
    key: "blocked",
    title: "Always block",
    description: "Actions the agent can never perform.",
    className: "pr-section-block",
    positive: false,
  },
];

interface ProtectionRulesEditorProps {
  onSaved?: () => void;
}

export default function ProtectionRulesEditor({ onSaved }: ProtectionRulesEditorProps) {
  const [config, setConfig] = useState<EditableProtectionConfig | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newRuleValues, setNewRuleValues] = useState<Record<ProtectionSection, string>>({
    allowed: "",
    askFirst: "",
    blocked: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadProtectionRules());
  }, []);

  if (!config) {
    return null;
  }

  const updateSection = (
    section: ProtectionSection,
    updater: (rules: EditableProtectionRule[]) => EditableProtectionRule[]
  ) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        [section]: updater(current[section]),
      };
    });
    setSavedMessage(null);
  };

  const startEdit = (rule: EditableProtectionRule) => {
    setEditingId(rule.id);
    setEditValue(rule.label);
  };

  const commitEdit = (section: ProtectionSection, ruleId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      return;
    }

    updateSection(section, (rules) =>
      rules.map((rule) => (rule.id === ruleId ? { ...rule, label: trimmed } : rule))
    );
    setEditingId(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const removeRule = (section: ProtectionSection, ruleId: string) => {
    updateSection(section, (rules) => rules.filter((rule) => rule.id !== ruleId));
    if (editingId === ruleId) {
      cancelEdit();
    }
  };

  const addRule = (section: ProtectionSection) => {
    const trimmed = newRuleValues[section].trim();
    if (!trimmed) {
      return;
    }

    updateSection(section, (rules) => [
      ...rules,
      { id: createProtectionRuleId(), label: trimmed },
    ]);
    setNewRuleValues((current) => ({ ...current, [section]: "" }));
  };

  const handleSave = () => {
    setSaving(true);
    saveProtectionRules(config);
    setSaving(false);
    setSavedMessage(null);
    showTrustToastByKey("rulesSaved");
    onSaved?.();
  };

  return (
    <div className="pr-editor">
      <p className="pr-purpose">Tell Wave what your AI agent is allowed to do.</p>

      <div className="pr-explanation pr-explanation-prominent" role="note">
        {PROTECTION_EXPLANATION}
      </div>

      <div className="pr-sections">
        {SECTIONS.map(({ key, title, description, className, positive }) => (
          <section
            key={key}
            className={`pr-section pr-section-editable ${className}`}
            aria-labelledby={`pr-${key}-title`}
          >
            <header className="pr-section-header">
              <h2 id={`pr-${key}-title`} className="pr-section-title">
                {title}
              </h2>
              <p className="pr-section-subtitle">{description}</p>
            </header>

            <ul className="pr-rule-list">
              {config[key].map((rule) => {
                const editing = editingId === rule.id;

                return (
                  <li key={rule.id} className="pr-rule-row">
                    <span className="pr-rule-icon" aria-hidden="true">
                      {positive ? (
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      ) : (
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      )}
                    </span>

                    {editing ? (
                      <input
                        className="ds-input pr-rule-input"
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitEdit(key, rule.id);
                          }
                          if (event.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        aria-label="Edit rule"
                        autoFocus
                      />
                    ) : (
                      <span className="pr-rule-label">{rule.label}</span>
                    )}

                    <div className="pr-rule-actions">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            className="pr-rule-action pr-rule-action-save"
                            onClick={() => commitEdit(key, rule.id)}
                            aria-label="Save rule"
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            className="pr-rule-action"
                            onClick={cancelEdit}
                            aria-label="Cancel edit"
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="pr-rule-action"
                            onClick={() => startEdit(rule)}
                            aria-label={`Edit ${rule.label}`}
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="pr-rule-action pr-rule-action-delete"
                            onClick={() => removeRule(key, rule.id)}
                            aria-label={`Remove ${rule.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="pr-add-rule">
              <input
                className="ds-input pr-add-input"
                value={newRuleValues[key]}
                placeholder="Add a new rule…"
                onChange={(event) =>
                  setNewRuleValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addRule(key);
                  }
                }}
                aria-label={`Add rule to ${title}`}
              />
              <button
                type="button"
                className="pr-add-btn"
                onClick={() => addRule(key)}
                disabled={!newRuleValues[key].trim()}
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Add
              </button>
            </div>
          </section>
        ))}
      </div>

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
    </div>
  );
}
