"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { formatAccountDate } from "@/lib/settings/founder-settings-copy";
import { formatLastUpdated, getTrustTenureBadge } from "@/lib/settings/trust-settings";

interface SettingsProfileCardProps {
  fullName: string;
  email: string | null;
  accountCreatedAt: string | null;
  lastUpdatedAt: string | null;
  authProvider: string;
  profileDirty: boolean;
  profileSaving: boolean;
  profileError: string | null;
  onNameChange: (value: string) => void;
  onSave: () => void | Promise<boolean>;
}

type SaveVisualState = "idle" | "visible" | "saving" | "saved";

function profileInitial(name: string, email: string | null): string {
  const source = name.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
}

export default function SettingsProfileCard({
  fullName,
  email,
  accountCreatedAt,
  lastUpdatedAt,
  authProvider,
  profileDirty,
  profileSaving,
  profileError,
  onNameChange,
  onSave,
}: SettingsProfileCardProps) {
  const [saveVisual, setSaveVisual] = useState<SaveVisualState>("idle");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const wasDirtyRef = useRef(false);

  const tenureBadge = getTrustTenureBadge(accountCreatedAt);
  const displayName = fullName.trim() || email?.split("@")[0] || "Your account";

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleHideUnsaved = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      setShowUnsavedWarning(false);
    }, 5000);
  }, [clearIdleTimer]);

  const handleNameChange = (value: string) => {
    onNameChange(value);
    setSaveVisual("visible");
    setShowUnsavedWarning(true);
    scheduleHideUnsaved();
  };

  useEffect(() => {
    if (profileDirty && !wasDirtyRef.current) {
      setSaveVisual("visible");
      setShowUnsavedWarning(true);
      scheduleHideUnsaved();
    }
    if (!profileDirty) {
      setShowUnsavedWarning(false);
      clearIdleTimer();
    }
    wasDirtyRef.current = profileDirty;
  }, [profileDirty, scheduleHideUnsaved, clearIdleTimer]);

  useEffect(() => {
    if (profileSaving) {
      setSaveVisual("saving");
    }
  }, [profileSaving]);

  useEffect(() => {
    return () => {
      clearIdleTimer();
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, [clearIdleTimer]);

  const handleSave = async () => {
    clearIdleTimer();
    setShowUnsavedWarning(false);
    setSaveVisual("saving");
    const ok = await onSave();
    if (!ok) {
      setSaveVisual(profileDirty ? "visible" : "idle");
      return;
    }
    setSaveVisual("saved");
    savedTimerRef.current = window.setTimeout(() => {
      setSaveVisual("idle");
    }, 2000);
  };

  const showSaveRow = profileDirty || saveVisual === "saved" || saveVisual === "saving";

  return (
    <article className="st-profile-card ds-panel">
      <div className="st-profile-hero">
        <span className="st-profile-avatar" aria-hidden="true">
          {profileInitial(fullName, email)}
        </span>
        <div className="st-profile-identity">
          <h3 className="st-profile-name">{displayName}</h3>
          <p className="st-profile-email">{email ?? "—"}</p>
          <div className="st-profile-meta">
            <span className="st-profile-member">
              Member since {formatAccountDate(accountCreatedAt)}
            </span>
            {tenureBadge ? (
              <span className="st-profile-trust-badge">{tenureBadge}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="st-profile-form">
        <div className="st-field">
          <label htmlFor="settings-name" className="ds-label">
            Display name
          </label>
          <input
            id="settings-name"
            type="text"
            className="ds-input w-full"
            value={fullName}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div className="st-field">
          <label htmlFor="settings-email" className="ds-label">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            className="ds-input w-full st-input-readonly"
            value={email ?? ""}
            readOnly
            aria-readonly="true"
          />
          <p className="st-field-hint">
            Sign-in via {authProvider}. Email is managed through authentication.
          </p>
        </div>
      </div>

      {profileError ? <p className="st-form-error">{profileError}</p> : null}

      {showSaveRow ? (
        <div className="st-profile-save-block st-profile-save-block-enter">
          <div className="st-profile-save-actions">
            {showUnsavedWarning && profileDirty && saveVisual !== "saved" ? (
              <span className="st-unsaved-warning" role="status">
                Unsaved changes
              </span>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              loading={saveVisual === "saving" || profileSaving}
              disabled={!profileDirty && saveVisual !== "saved"}
              className={
                saveVisual === "saved"
                  ? "st-save-btn-saved"
                  : saveVisual === "saving"
                    ? "st-save-btn-saving"
                    : ""
              }
            >
              {saveVisual === "saved" ? "✓ Saved" : "Save Changes"}
            </Button>
          </div>
          <div className="st-profile-save-meta">
            <p>Last updated: {formatLastUpdated(lastUpdatedAt)}</p>
            <p>Changes are synced across all devices</p>
          </div>
        </div>
      ) : (
        <div className="st-profile-save-meta st-profile-save-meta-static">
          <p>Last updated: {formatLastUpdated(lastUpdatedAt)}</p>
          <p>Changes are synced across all devices</p>
        </div>
      )}
    </article>
  );
}
