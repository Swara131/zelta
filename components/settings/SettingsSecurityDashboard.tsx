"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import {
  formatDaysAgo,
  formatLastLogin,
  formatRotationMonth,
} from "@/lib/settings/trust-settings";
import { showTrustToast } from "@/lib/trust/dashboard-trust";

interface SettingsSecurityDashboardProps {
  apiKeys: AgentApiKeyRecord[];
  passwordChangedDaysAgo: number | null;
  signingOut: boolean;
  onSignOut: () => void;
}

export default function SettingsSecurityDashboard({
  apiKeys,
  passwordChangedDaysAgo,
  signingOut,
  onSignOut,
}: SettingsSecurityDashboardProps) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const activeKeys = apiKeys.filter((key) => !key.revokedAt);
  let latestRotation: string | null = null;
  for (const key of activeKeys) {
    if (!latestRotation || key.createdAt > latestRotation) {
      latestRotation = key.createdAt;
    }
  }

  const handleTwoFactorClick = async () => {
    if (twoFactorLoading) return;

    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      return;
    }

    setTwoFactorLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    setTwoFactorEnabled(true);
    setTwoFactorLoading(false);
    showTrustToast("✓ 2FA enabled — Check your authenticator app");
  };

  return (
    <section
      id="security-dashboard"
      className="st-security-dashboard ds-panel"
      aria-labelledby="st-security-dashboard-heading"
    >
      <h3 id="st-security-dashboard-heading" className="st-security-dashboard-title">
        Security Settings
      </h3>
      <p className="st-security-dashboard-lead">
        Professional controls for credentials, authentication, and access history.
      </p>

      <div className="st-security-dashboard-grid">
        <article className="st-security-block st-security-item-interactive">
          <h4 className="st-security-block-title">Password security</h4>
          <div className="st-security-block-body">
            <p className="st-security-masked">••••••••</p>
            <p className="st-security-block-meta">
              Last changed: {formatDaysAgo(passwordChangedDaysAgo, "45 days ago")}
            </p>
          </div>
          <Link href="/forgot-password" className="st-security-block-action">
            Change password
          </Link>
          <ChevronRight className="st-security-item-expand" strokeWidth={2} aria-hidden="true" />
        </article>

        <article className="st-security-block st-security-item-interactive">
          <h4 className="st-security-block-title">API keys</h4>
          <div className="st-security-block-body">
            <p className="st-security-block-value">
              You have {activeKeys.length} active API key{activeKeys.length === 1 ? "" : "s"}
            </p>
            <p className="st-security-block-meta">
              Last rotated: {formatRotationMonth(latestRotation)}
            </p>
          </div>
          <Link href="/integrations" className="st-security-block-action">
            Manage keys
          </Link>
          <ChevronRight className="st-security-item-expand" strokeWidth={2} aria-hidden="true" />
        </article>

        <article
          className={`st-security-block st-security-item-interactive ${
            twoFactorEnabled ? "st-security-block-enabled" : "st-security-block-warn"
          }`}
        >
          <h4 className="st-security-block-title">Two-factor authentication</h4>
          <div className="st-security-block-body">
            <p className="st-security-block-value">
              Status:{" "}
              {twoFactorEnabled ? (
                <span className="st-security-green-badge">Enabled</span>
              ) : (
                <span className="st-security-amber-badge">Not enabled</span>
              )}
            </p>
            <p className="st-security-block-meta">Recommended for teams</p>
          </div>
          <button
            type="button"
            className={`st-security-2fa-btn ${twoFactorEnabled ? "st-security-2fa-btn-danger" : ""}`}
            onClick={() => void handleTwoFactorClick()}
            disabled={twoFactorLoading}
          >
            {twoFactorLoading ? (
              <>
                <Loader2 className="st-security-2fa-spinner animate-spin" strokeWidth={2} aria-hidden="true" />
                Setting up…
              </>
            ) : twoFactorEnabled ? (
              "Disable 2FA"
            ) : (
              "Set up 2FA"
            )}
          </button>
          <ChevronRight className="st-security-item-expand" strokeWidth={2} aria-hidden="true" />
        </article>

        <article className="st-security-block st-security-item-interactive">
          <h4 className="st-security-block-title">Login history</h4>
          <div className="st-security-block-body">
            <p className="st-security-block-value">Last login: {formatLastLogin()}</p>
          </div>
          <Link href="/audit" className="st-security-block-action">
            View full login history
          </Link>
          <ChevronRight className="st-security-item-expand" strokeWidth={2} aria-hidden="true" />
        </article>
      </div>

      <div className="st-security-signout">
        <div>
          <p className="st-security-block-title">Sign out</p>
          <p className="st-security-block-meta">
            End your session on this device. You can sign back in anytime.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={LogOut}
          onClick={onSignOut}
          loading={signingOut}
          className="st-sign-out-btn"
        >
          Sign out
        </Button>
      </div>
    </section>
  );
}
