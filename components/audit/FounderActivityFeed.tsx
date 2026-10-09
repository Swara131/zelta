"use client";

import { useState } from "react";
import {
  activityToneClass,
  riskToneClass,
  statusToneClass,
  type FounderActivityView,
} from "@/lib/audit/activity-copy";
import ActivityDetailPanel from "./ActivityDetailPanel";

interface FounderActivityFeedProps {
  activities: FounderActivityView[];
}

export default function FounderActivityFeed({ activities }: FounderActivityFeedProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="act-trail">
      <div className="act-trail-table-wrap ds-panel" role="region" aria-label="Agent activity audit trail">
        <table className="act-trail-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Agent</th>
              <th scope="col">Action</th>
              <th scope="col">Risk</th>
              <th scope="col">Decision</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, index) => {
              const selected = selectedId === activity.id;

              return (
                <tr key={activity.id} className="act-trail-row-group">
                  <td colSpan={6} className="act-trail-row-cell">
                    <button
                      type="button"
                      className={`act-trail-row ${selected ? "act-trail-row-selected" : ""}`}
                      style={{ animationDelay: `${index * 40}ms` }}
                      aria-expanded={selected}
                      onClick={() => setSelectedId(selected ? null : activity.id)}
                    >
                      <span className="act-trail-time">{activity.timeDisplay}</span>
                      <span className="act-trail-agent">
                        {activity.agentName}
                        {activity.isSimulated ? (
                          <span className="act-trail-demo-tag">Demo</span>
                        ) : null}
                      </span>
                      <span className="act-trail-action">{activity.actionLabel}</span>
                      <span className={`act-trail-risk ${riskToneClass(activity.riskLabel)}`}>
                        {activity.riskLabel}
                      </span>
                      <span
                        className={`act-trail-decision ${activityToneClass(activity.tone)}`}
                      >
                        {activity.decisionLabel}
                      </span>
                      <span
                        className={`act-trail-status ${statusToneClass(activity.statusLabel)}`}
                      >
                        {activity.statusLabel}
                      </span>
                    </button>

                    {selected ? (
                      <div className="act-trail-detail-wrap">
                        <ActivityDetailPanel activity={activity} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
