"use client";

import type { ProtectionBreakdownItem } from "@/lib/analytics/founder-insights";

interface InsightsProtectionBreakdownProps {
  items: ProtectionBreakdownItem[];
}

export default function InsightsProtectionBreakdown({
  items,
}: InsightsProtectionBreakdownProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <p className="ins-empty-inline">
        No protection decisions recorded yet. When agents propose actions, Wave&apos;s
        decisions will appear here.
      </p>
    );
  }

  return (
    <div className="ins-breakdown">
      <div
        className="ins-breakdown-bar"
        role="img"
        aria-label={`Protection overview: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}
      >
        {items.map((item) =>
          item.value > 0 ? (
            <span
              key={item.key}
              className="ins-breakdown-segment"
              style={{
                flexGrow: item.value,
                backgroundColor: item.color,
              }}
              title={`${item.label}: ${item.value}`}
            />
          ) : null
        )}
      </div>

      <ul className="ins-breakdown-legend">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.key} className="ins-breakdown-legend-item">
              <span
                className="ins-breakdown-dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <div className="ins-breakdown-copy">
                <div className="ins-breakdown-row">
                  <span className="ins-breakdown-label">{item.label}</span>
                  <span className="ins-breakdown-value">
                    {item.value.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <p className="ins-breakdown-explanation">{item.explanation}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
