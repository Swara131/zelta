"use client";

import { Check, Lock, Shield } from "lucide-react";
import { SETTINGS_TRUST_BADGES } from "@/lib/settings/trust-settings";

const BADGE_ICONS = {
  check: Check,
  lock: Lock,
  shield: Shield,
} as const;

export default function SettingsTrustHeader() {
  return (
    <section
      className="st-trust-board"
      id="trust-compliance"
      aria-labelledby="st-trust-heading"
    >
      <div className="st-trust-board-head">
        <span className="st-trust-board-icon" aria-hidden="true">
          <Shield className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <p className="st-trust-board-kicker">Security status</p>
          <h2 id="st-trust-heading" className="st-trust-board-title">
            Your workspace meets enterprise security standards
          </h2>
        </div>
      </div>

      <ul className="st-trust-pills" aria-label="Compliance and security badges">
        {SETTINGS_TRUST_BADGES.map((badge, index) => {
          const Icon = BADGE_ICONS[badge.icon];
          return (
            <li
              key={badge.id}
              className="st-trust-pill st-trust-pill-enter"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Icon className="st-trust-pill-icon" strokeWidth={2.5} aria-hidden="true" />
              <span>{badge.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
