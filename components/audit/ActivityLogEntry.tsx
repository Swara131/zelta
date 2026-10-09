"use client";

import type { FounderActivityView } from "@/lib/audit/activity-copy";
import { activityToneClass, statusToneClass } from "@/lib/audit/activity-copy";

interface ActivityLogEntryProps {
  activity: FounderActivityView;
}

function formatRiskDisplay(activity: FounderActivityView): string {
  const score = activity.technical.metadata.riskScore;
  if (typeof score === "number" && Number.isFinite(score)) {
    const normalized = score > 1 ? score / 100 : score;
    return `${normalized.toFixed(2)} (${activity.riskLabel})`;
  }
  return activity.riskLabel;
}

export default function ActivityLogEntry({ activity }: ActivityLogEntryProps) {
  return (
    <article className="act-log-entry ds-panel">
      <p className="act-log-message">{activity.message}</p>

      <dl className="act-log-meta">
        <div>
          <dt>Status</dt>
          <dd className={statusToneClass(activity.statusLabel)}>{activity.statusLabel}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd className={activityToneClass(activity.tone)}>{activity.decisionLabel}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{formatRiskDisplay(activity)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{activity.details.timeFull}</dd>
        </div>
      </dl>
    </article>
  );
}
