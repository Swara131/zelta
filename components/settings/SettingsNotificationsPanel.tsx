"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  NOTIFICATION_ALERT_ITEMS,
  NOTIFICATION_EXAMPLE,
} from "@/lib/settings/trust-settings";
import ApprovalChannelsPanel from "./ApprovalChannelsPanel";

interface SettingsNotificationsPanelProps {
  email: string | null;
}

export default function SettingsNotificationsPanel({ email }: SettingsNotificationsPanelProps) {
  const [testStates, setTestStates] = useState<Record<string, "idle" | "sending" | "sent">>({});

  const handleTest = async (id: string, type: "email" | "examples") => {
    if (type === "examples") return;

    setTestStates((current) => ({ ...current, [id]: "sending" }));
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setTestStates((current) => ({ ...current, [id]: "sent" }));
    window.setTimeout(() => {
      setTestStates((current) => ({ ...current, [id]: "idle" }));
    }, 6000);
  };

  return (
    <>
      <ApprovalChannelsPanel email={email} />

      <section className="st-notifications-panel ds-panel" aria-labelledby="st-notifications-heading">
      <div className="st-notifications-head">
        <h3 id="st-notifications-heading" className="st-notifications-title">
          <span aria-hidden="true">🔔</span> Real-Time Approval Alerts
        </h3>
        <Link href="/notifications" className="st-link-inline">
          View Alerts
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <p className="st-notifications-lead">
        Time-sensitive agent actions reach you instantly — approve or block before they run.
      </p>

      <ul className="st-notifications-alerts">
        {NOTIFICATION_ALERT_ITEMS.map((item) => {
          const state = testStates[item.id] ?? "idle";

          return (
            <li key={item.id} className="st-notifications-alert-row">
              <div className="st-notifications-alert-copy">
                <p className="st-notifications-alert-title">{item.title}</p>
                <span
                  className={`st-notifications-alert-status st-notifications-alert-status-${item.tone}`}
                >
                  {item.statusLabel}
                </span>
              </div>

              {item.testType === "examples" ? (
                <Link href="/audit" className="ds-btn ds-btn-secondary ds-btn-sm">
                  {item.testLabel}
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  className="ds-btn-sm"
                  loading={state === "sending"}
                  disabled={state === "sent"}
                  onClick={() => void handleTest(item.id, item.testType)}
                >
                  {item.testLabel}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {NOTIFICATION_ALERT_ITEMS.some((item) => testStates[item.id] === "sent") ? (
        <div className="st-notifications-test-result" role="status">
          <p className="st-notifications-test-sent">
            Test notification sent to {email ?? "your inbox"}
          </p>
          <p className="st-notifications-test-hint">Check your inbox in 30 seconds</p>
        </div>
      ) : (
        <div className="st-notification-example" role="note">
          <p className="st-notification-example-label">Example alert</p>
          <p className="st-notification-example-text">{NOTIFICATION_EXAMPLE}</p>
        </div>
      )}
    </section>
    </>
  );
}
