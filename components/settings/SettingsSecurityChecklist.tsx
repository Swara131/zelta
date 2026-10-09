"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import Button from "@/components/ui/Button";
import type { SecurityChecklistItem } from "@/lib/settings/trust-settings";

interface SettingsSecurityChecklistProps {
  items: SecurityChecklistItem[];
  onSecurityCheckup: () => void;
}

function toneIcon(tone: SecurityChecklistItem["tone"]) {
  if (tone === "good") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-400" strokeWidth={2} aria-hidden="true" />;
  }
  if (tone === "warn") {
    return (
      <AlertTriangle className="h-5 w-5 text-amber-400" strokeWidth={2} aria-hidden="true" />
    );
  }
  return <Circle className="h-5 w-5 text-[var(--ds-text-tertiary)]" strokeWidth={2} aria-hidden="true" />;
}

export default function SettingsSecurityChecklist({
  items,
  onSecurityCheckup,
}: SettingsSecurityChecklistProps) {
  return (
    <div className="st-security-checklist">
      <ul className="st-security-checklist-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`st-security-checklist-item st-security-checklist-item-${item.tone}`}
          >
            <span className="st-security-checklist-icon">{toneIcon(item.tone)}</span>
            <div className="min-w-0 flex-1">
              <p className="st-security-checklist-title">{item.title}</p>
              <p className="st-security-checklist-status">{item.status}</p>
            </div>
            {item.href && item.actionLabel ? (
              <Link href={item.href} className="st-security-checklist-action">
                {item.actionLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="st-security-checkup-cta">
        <Button variant="secondary" onClick={onSecurityCheckup}>
          Security checkup
        </Button>
        <p className="st-security-checkup-hint">
          Walk through password, API keys, and audit log best practices.
        </p>
      </div>
    </div>
  );
}
