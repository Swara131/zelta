"use client";

import { ChevronDown } from "lucide-react";
import type { FounderActivityView } from "@/lib/audit/activity-copy";

interface ActivityDetailPanelProps {
  activity: FounderActivityView;
}

export default function ActivityDetailPanel({ activity }: ActivityDetailPanelProps) {
  return (
    <div className="act-detail-panel ds-panel">
      <h3 className="act-detail-heading">What happened?</h3>

      <section className="act-detail-section">
        <p className="act-detail-kicker">Agent proposed</p>
        <blockquote className="act-detail-quote">
          &ldquo;{activity.proposedAction}&rdquo;
        </blockquote>
      </section>

      <section className="act-detail-section">
        <p className="act-detail-kicker">Wave checked</p>
        <dl className="act-zelta-checks">
          <div>
            <dt>Policy</dt>
            <dd>{activity.zeltaChecked.policy}</dd>
          </div>
          <div>
            <dt>Risk</dt>
            <dd>{activity.zeltaChecked.risk}</dd>
          </div>
          <div>
            <dt>Human review</dt>
            <dd>{activity.zeltaChecked.humanReview}</dd>
          </div>
        </dl>
      </section>

      <section className="act-detail-section">
        <p className="act-detail-kicker">Final decision</p>
        <p className="act-detail-final">&ldquo;{activity.finalDecisionText}&rdquo;</p>
      </section>

      {activity.isSimulated ? (
        <p className="act-detail-simulated">Simulated event — not from a live agent.</p>
      ) : null}

      <details className="cp-advanced-setup act-advanced">
        <summary className="cp-advanced-setup-summary">
          Advanced technical details
          <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </summary>
        <div className="cp-advanced-setup-body">
          <pre className="ab-spec-json">
            {JSON.stringify(activity.technical, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}
