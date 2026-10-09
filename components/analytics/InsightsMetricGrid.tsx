"use client";

import type { InsightMetric } from "@/lib/analytics/founder-insights";

interface InsightsMetricGridProps {
  metrics: InsightMetric[];
}

export default function InsightsMetricGrid({ metrics }: InsightsMetricGridProps) {
  return (
    <div className="ins-metrics-grid">
      {metrics.map((metric) => (
        <article
          key={metric.key}
          className={`ins-metric-card ds-panel ins-metric-${metric.key}`}
        >
          <p className="ins-metric-value">{metric.value.toLocaleString()}</p>
          <p className="ins-metric-label">{metric.label}</p>
          <p className="ins-metric-explanation">{metric.explanation}</p>
        </article>
      ))}
    </div>
  );
}
