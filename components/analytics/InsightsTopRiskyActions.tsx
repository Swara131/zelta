"use client";

import type { TopRiskyActionRow } from "@/lib/analytics/founder-insights";

interface InsightsTopRiskyActionsProps {
  items: TopRiskyActionRow[];
}

export default function InsightsTopRiskyActions({ items }: InsightsTopRiskyActionsProps) {
  return (
    <ul className="ins-risky-list">
      {items.map((item) => (
        <li key={item.key} className="ins-risky-item ds-panel">
          <div className="ins-risky-header">
            <span className="ins-risky-label">{item.label}</span>
            <span className="ins-risky-count">
              {item.count === 0 ? "None yet" : `${item.count} checked`}
            </span>
          </div>
          <p className="ins-risky-explanation">{item.explanation}</p>
        </li>
      ))}
    </ul>
  );
}
