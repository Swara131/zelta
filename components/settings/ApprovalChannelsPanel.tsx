"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Monitor, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  APPROVAL_CHANNEL_COPY,
  type ApprovalChannelPreferences,
} from "@/lib/settings/approval-channels";

interface ApprovalChannelsPanelProps {
  email: string | null;
}

type VerifyStep = "idle" | "code_sent" | "verified";

async function fetchChannels(): Promise<ApprovalChannelPreferences> {
  const response = await fetch("/api/settings/approval-channels");
  const payload = (await response.json()) as {
    channels?: ApprovalChannelPreferences;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load approval channels.");
  }

  return payload.channels!;
}

export default function ApprovalChannelsPanel({ email }: ApprovalChannelsPanelProps) {
  const [channels, setChannels] = useState<ApprovalChannelPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [phoneInput, setPhoneInput] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyStep, setVerifyStep] = useState<VerifyStep>("idle");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchChannels();
      setChannels(data);
      if (data.whatsappVerified && data.whatsappPhoneDisplay) {
        setVerifyStep("verified");
        setPhoneInput(data.whatsappPhoneDisplay.replace(/\s/g, " ").trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approval channels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const saveChannels = async (patch: Partial<ApprovalChannelPreferences>) => {
    if (!channels) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings/approval-channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled: patch.emailEnabled ?? channels.emailEnabled,
          whatsappEnabled: patch.whatsappEnabled ?? channels.whatsappEnabled,
          dashboardEnabled: patch.dashboardEnabled ?? channels.dashboardEnabled,
        }),
      });

      const payload = (await response.json()) as {
        channels?: ApprovalChannelPreferences;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update channels.");
      }

      setChannels(payload.channels!);
      setMessage("Approval channels updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update channels.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendCode = async () => {
    setVerifyLoading(true);
    setError(null);
    setMessage(null);
    setDevCodeHint(null);

    try {
      const response = await fetch("/api/settings/whatsapp/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        devCode?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send verification code.");
      }

      setVerifyStep("code_sent");
      setMessage("Verification code sent on WhatsApp.");
      if (payload.devCode) {
        setDevCodeHint(`Dev code: ${payload.devCode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setVerifyLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, code: verifyCode }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        channels?: ApprovalChannelPreferences;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Verification failed.");
      }

      setChannels(payload.channels!);
      setVerifyStep("verified");
      setVerifyCode("");
      setDevCodeHint(null);
      setMessage("WhatsApp verified — approval alerts enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="st-approval-channels-loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading approval channels…
      </div>
    );
  }

  if (!channels) {
    return null;
  }

  return (
    <section className="st-approval-channels ds-panel" aria-labelledby="st-approval-channels-heading">
      <h3 id="st-approval-channels-heading" className="st-approval-channels-title">
        APPROVAL CHANNELS
      </h3>
      <p className="st-approval-channels-lead">{APPROVAL_CHANNEL_COPY.sectionLead}</p>

      <ul className="st-approval-channel-list">
        <li className="st-approval-channel-row">
          <label className="st-approval-channel-label">
            <input
              type="checkbox"
              checked={channels.emailEnabled}
              disabled={saving}
              onChange={(event) =>
                void saveChannels({ emailEnabled: event.target.checked })
              }
            />
            <span className="st-approval-channel-icon" aria-hidden="true">
              <Mail className="h-4 w-4" strokeWidth={2} />
            </span>
            <span>
              <span className="st-approval-channel-name">{APPROVAL_CHANNEL_COPY.emailLabel}</span>
              <span className="st-approval-channel-hint">
                {email ? `${APPROVAL_CHANNEL_COPY.emailHint} · ${email}` : APPROVAL_CHANNEL_COPY.emailHint}
              </span>
            </span>
          </label>
          {channels.emailEnabled ? (
            <span className="st-approval-channel-badge st-approval-channel-badge-on">Enabled</span>
          ) : null}
        </li>

        <li className="st-approval-channel-row st-approval-channel-row-whatsapp">
          <label className="st-approval-channel-label">
            <input
              type="checkbox"
              checked={channels.whatsappEnabled}
              disabled={saving || !channels.whatsappVerified}
              onChange={(event) =>
                void saveChannels({ whatsappEnabled: event.target.checked })
              }
            />
            <span className="st-approval-channel-icon st-approval-channel-icon-whatsapp" aria-hidden="true">
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
            </span>
            <span>
              <span className="st-approval-channel-name">
                {APPROVAL_CHANNEL_COPY.whatsappLabel}
                <span className="st-approval-channel-new">NEW</span>
              </span>
              <span className="st-approval-channel-hint">{APPROVAL_CHANNEL_COPY.whatsappHint}</span>
            </span>
          </label>
          {channels.whatsappVerified ? (
            <span className="st-approval-channel-badge st-approval-channel-badge-on">
              {channels.whatsappPhoneMasked ?? "Verified"}
            </span>
          ) : (
            <span className="st-approval-channel-badge">Not connected</span>
          )}
        </li>

        <li className="st-approval-channel-row">
          <label className="st-approval-channel-label">
            <input
              type="checkbox"
              checked={channels.dashboardEnabled}
              disabled={saving}
              onChange={(event) =>
                void saveChannels({ dashboardEnabled: event.target.checked })
              }
            />
            <span className="st-approval-channel-icon" aria-hidden="true">
              <Monitor className="h-4 w-4" strokeWidth={2} />
            </span>
            <span>
              <span className="st-approval-channel-name">{APPROVAL_CHANNEL_COPY.dashboardLabel}</span>
              <span className="st-approval-channel-hint">{APPROVAL_CHANNEL_COPY.dashboardHint}</span>
            </span>
          </label>
          {channels.dashboardEnabled ? (
            <span className="st-approval-channel-badge st-approval-channel-badge-on">Enabled</span>
          ) : null}
        </li>
      </ul>

      {!channels.whatsappVerified ? (
        <div className="st-whatsapp-setup">
          <h4 className="st-whatsapp-setup-title">{APPROVAL_CHANNEL_COPY.whatsappSetupTitle}</h4>
          <p className="st-whatsapp-setup-lead">{APPROVAL_CHANNEL_COPY.whatsappSetupLead}</p>

          <div className="st-whatsapp-setup-fields">
            <label className="ds-label" htmlFor="whatsapp-phone">
              WhatsApp number
            </label>
            <input
              id="whatsapp-phone"
              type="tel"
              className="ds-input w-full"
              placeholder="+91 XXXXX XXXXX"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              autoComplete="tel"
            />

            {verifyStep === "code_sent" ? (
              <>
                <label className="ds-label" htmlFor="whatsapp-code">
                  Verification code
                </label>
                <input
                  id="whatsapp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="ds-input w-full"
                  placeholder="6-digit code"
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, ""))}
                />
              </>
            ) : null}
          </div>

          <div className="st-whatsapp-setup-actions">
            {verifyStep !== "code_sent" ? (
              <Button
                variant="secondary"
                loading={verifyLoading}
                onClick={() => void handleSendCode()}
              >
                Send verification code
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={verifyLoading}
                disabled={verifyCode.length !== 6}
                onClick={() => void handleVerifyCode()}
              >
                Confirm number
              </Button>
            )}
          </div>

          {devCodeHint ? <p className="st-whatsapp-dev-hint">{devCodeHint}</p> : null}
        </div>
      ) : (
        <p className="st-whatsapp-verified-note">
          {APPROVAL_CHANNEL_COPY.whatsappVerifiedLabel}: {channels.whatsappPhoneDisplay}
        </p>
      )}

      {error ? <p className="st-form-error">{error}</p> : null}
      {message ? <p className="st-form-success">{message}</p> : null}

      <div className="st-whatsapp-example" role="note">
        <p className="st-whatsapp-example-label">Example WhatsApp alert</p>
        <pre className="st-whatsapp-example-text">{`🔔 Refund Handler needs your approval

Issue ₹8,000 refund?
Customer: Priya Singh
Risk: HIGH (0.72)

Approve: [link]
Reject: [link]

Tap to approve on Wave dashboard`}</pre>
      </div>
    </section>
  );
}
