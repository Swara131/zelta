"use client";

import { AlertTriangle, Check } from "lucide-react";
import type { RiskScoreBreakdownView } from "@/lib/approvals/risk-score-breakdown";
import { formatRiskFactorDelta } from "@/lib/approvals/risk-score-breakdown";

interface RiskScoreBreakdownPanelProps {
  breakdown: RiskScoreBreakdownView;
  compact?: boolean;
}

function FactorIcon({ emphasis }: { emphasis: "primary" | "warning" }) {
  if (emphasis === "warning") {
    return (
      <AlertTriangle
        className="ap-risk-factor-icon ap-risk-factor-icon-warning"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    );
  }

  return (
    <Check className="ap-risk-factor-icon ap-risk-factor-icon-primary" strokeWidth={2.5} aria-hidden="true" />
  );
}

export default function RiskScoreBreakdownPanel({
  breakdown,
  compact = false,
}: RiskScoreBreakdownPanelProps) {
  if (breakdown.factors.length === 0) {
    return null;
  }

  return (
    <section
      className={`ap-risk-breakdown ${compact ? "ap-risk-breakdown-compact" : ""}`}
      aria-label="Risk score reasoning"
    >
      <h3 className="ap-risk-breakdown-title">{breakdown.sectionTitle}</h3>
      <ul className="ap-risk-factor-list">
        {breakdown.factors.map((factor) => {
          const delta = formatRiskFactorDelta(factor);
          return (
            <li
              key={`${factor.source}-${factor.label}`}
              className={`ap-risk-factor-item ${
                factor.direction === "decrease" ? "ap-risk-factor-mitigating" : ""
              }`}
            >
              <FactorIcon emphasis={factor.emphasis} />
              <span className="ap-risk-factor-label">
                {factor.label}
                {delta ? <span className="ap-risk-factor-delta"> {delta}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {!breakdown.hasWeightedFactors ? (
        <p className="ap-risk-breakdown-note">
          Detailed factor weights will appear once AI risk scoring completes for this action.
        </p>
      ) : null}
    </section>
  );
}
