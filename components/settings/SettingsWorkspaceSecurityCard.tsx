"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  HelpCircle,
} from "lucide-react";
import type { WorkspaceSecuritySnapshot } from "@/lib/settings/trust-settings";
import { API_KEY_ROTATION_TOOLTIP } from "@/lib/settings/trust-settings";

interface SettingsWorkspaceSecurityCardProps {
  snapshot: WorkspaceSecuritySnapshot;
}

function itemIcon(complete: boolean, tone: "good" | "warn" | "neutral") {
  if (complete) {
    return (
      <CheckCircle2 className="st-ws-item-icon st-ws-item-icon-good" strokeWidth={2} aria-hidden="true" />
    );
  }
  if (tone === "warn") {
    return (
      <AlertTriangle className="st-ws-item-icon st-ws-item-icon-warn" strokeWidth={2} aria-hidden="true" />
    );
  }
  return <Circle className="st-ws-item-icon" strokeWidth={2} aria-hidden="true" />;
}

export default function SettingsWorkspaceSecurityCard({
  snapshot,
}: SettingsWorkspaceSecurityCardProps) {
  return (
    <section className="st-workspace-board ds-panel" aria-labelledby="st-workspace-security-heading">
      <div className="st-workspace-board-top">
        <div className="st-workspace-board-head">
          <span className="st-workspace-board-lock" aria-hidden="true">
            🔒
          </span>
          <div>
            <h3 id="st-workspace-security-heading" className="st-workspace-board-title">
              Workspace Security
            </h3>
            <p className="st-workspace-board-subtitle">
              Wave monitors and protects your workspace 24/7
            </p>
          </div>
        </div>

        <div className="st-workspace-score" aria-label={`Security score ${snapshot.securityScore} out of 100`}>
          <span className="st-workspace-score-label">Security score</span>
          <span className="st-workspace-score-value">
            {snapshot.securityScore}
            <span className="st-workspace-score-max">/100</span>
          </span>
        </div>
      </div>

      <ul className="st-workspace-checklist">
        {snapshot.checklist.map((item) => (
          <li
            key={item.id}
            className={`st-workspace-checklist-item st-workspace-checklist-item-${item.tone} st-security-item-interactive`}
          >
            <span className="st-workspace-checklist-icon">{itemIcon(item.complete, item.tone)}</span>
            <div className="st-workspace-checklist-copy">
              <p className="st-workspace-checklist-label">
                {item.complete ? (
                  <Check className="st-ws-inline-check" strokeWidth={2.5} aria-hidden="true" />
                ) : null}
                {item.label}
              </p>
              <p className="st-workspace-checklist-detail">
                {item.detail}
                {item.id === "api-keys" ? (
                  <span className="st-api-rotation-tip-wrap">
                    <button
                      type="button"
                      className="st-api-rotation-tip-trigger"
                      aria-label="API key rotation guidance"
                      title={API_KEY_ROTATION_TOOLTIP}
                    >
                      <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                    <span className="st-api-rotation-tooltip" role="tooltip">
                      {API_KEY_ROTATION_TOOLTIP}
                    </span>
                  </span>
                ) : null}
              </p>
            </div>
            {item.href && item.actionLabel ? (
              <Link href={item.href} className="st-workspace-checklist-action">
                {item.actionLabel}
              </Link>
            ) : null}
            <ChevronRight
              className="st-security-item-expand"
              strokeWidth={2}
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
