"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  loadStructuredProtectionRules,
  saveStructuredProtectionRules,
} from "@/lib/protection/structured-rules";
import { applyPolicyLearningSuggestion } from "@/lib/protection/policy-learning/apply";
import { readRefundThresholdFromStructuredRules } from "@/lib/protection/policy-learning/threshold";
import type {
  PolicyLearningSuggestion,
  PolicyLearningView,
} from "@/lib/protection/policy-learning/types";

interface PolicyLearningPanelProps {
  onRulesApplied?: () => void;
}

async function fetchPolicyLearning(thresholdInr: number): Promise<PolicyLearningView> {
  const response = await fetch(
    `/api/protection/policy-learning?thresholdInr=${encodeURIComponent(String(thresholdInr))}`
  );
  const payload = (await response.json()) as {
    learning?: PolicyLearningView;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load policy learning.");
  }

  return payload.learning!;
}

export default function PolicyLearningPanel({ onRulesApplied }: PolicyLearningPanelProps) {
  const [learning, setLearning] = useState<PolicyLearningView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const threshold = readRefundThresholdFromStructuredRules(loadStructuredProtectionRules());
      const view = await fetchPolicyLearning(threshold);
      setLearning(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy learning.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApply = async (suggestion: PolicyLearningSuggestion) => {
    setApplyingId(suggestion.id);
    setMessage(null);
    setError(null);

    try {
      const current = loadStructuredProtectionRules();
      const updated = applyPolicyLearningSuggestion(current, suggestion);
      saveStructuredProtectionRules(updated);
      setAppliedIds((current) => new Set(current).add(suggestion.id));
      setMessage(`Applied: ${suggestion.title.replace(/\?$/, "")}`);
      onRulesApplied?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply suggestion.");
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) {
    return (
      <section className="prot-learning ds-panel" aria-label="Policy learning">
        <div className="prot-learning-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Analyzing your approval history…
        </div>
      </section>
    );
  }

  if (!learning) {
    return null;
  }

  return (
    <section className="prot-learning ds-panel" aria-labelledby="prot-learning-heading">
      <div className="prot-learning-head">
        <h2 id="prot-learning-heading" className="prot-learning-title">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          POLICY LEARNING
          <span className="prot-learning-new">NEW</span>
        </h2>
        <p className="prot-learning-lead">
          Wave learns from your approvals and suggests smarter protection rules.
        </p>
      </div>

      {!learning.hasEnoughData ? (
        <p className="prot-learning-empty">
          Not enough approval history yet. As you approve or reject agent actions, Wave will
          surface patterns here — no guesswork, only your real decisions.
        </p>
      ) : (
        <>
          <div className="prot-learning-patterns">
            <h3 className="prot-learning-subtitle">Your approval patterns</h3>
            <ul className="prot-learning-pattern-list">
              {learning.refundBuckets
                .filter((bucket) => bucket.total > 0)
                .map((bucket) => (
                  <li key={bucket.id} className="prot-learning-pattern-item">
                    <span>{bucket.label}:</span>
                    <strong>
                      {bucket.approvalRatePercent != null
                        ? `${bucket.approvalRatePercent}% approved`
                        : "No decisions yet"}
                    </strong>
                    <span className="prot-learning-pattern-meta">
                      ({bucket.total} decision{bucket.total === 1 ? "" : "s"})
                    </span>
                  </li>
                ))}
            </ul>
            <p className="prot-learning-window">
              Based on {learning.analyzedProposalCount} finalized actions in the last{" "}
              {learning.windowDays} days.
            </p>
          </div>

          {learning.suggestions.length > 0 ? (
            <div className="prot-learning-suggestions">
              <h3 className="prot-learning-subtitle">Suggestions</h3>
              <ol className="prot-learning-suggestion-list">
                {learning.suggestions.map((suggestion, index) => {
                  const applied = appliedIds.has(suggestion.id);
                  return (
                    <li key={suggestion.id} className="prot-learning-suggestion-card">
                      <div className="prot-learning-suggestion-copy">
                        <p className="prot-learning-suggestion-index">{index + 1}.</p>
                        <div>
                          <p className="prot-learning-suggestion-title">{suggestion.title}</p>
                          <p className="prot-learning-suggestion-detail">{suggestion.detail}</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        className="ds-btn-sm"
                        loading={applyingId === suggestion.id}
                        disabled={applied || !!applyingId}
                        onClick={() => void handleApply(suggestion)}
                      >
                        {applied ? "Applied" : "Apply suggestion"}
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <p className="prot-learning-empty">
              No threshold changes suggested yet. Your current rules match how you have been
              deciding.
            </p>
          )}
        </>
      )}

      {error ? <p className="st-form-error">{error}</p> : null}
      {message ? <p className="st-form-success">{message}</p> : null}
    </section>
  );
}
