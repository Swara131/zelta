"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Settings } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import SettingsTrustHeader from "@/components/settings/SettingsTrustHeader";
import SettingsTrustFooter from "@/components/settings/SettingsTrustFooter";
import SettingsProfileCard from "@/components/settings/SettingsProfileCard";
import SettingsWorkspaceSecurityCard from "@/components/settings/SettingsWorkspaceSecurityCard";
import SettingsNotificationsPanel from "@/components/settings/SettingsNotificationsPanel";
import SettingsSecurityDashboard from "@/components/settings/SettingsSecurityDashboard";
import { signOut, AuthError } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentApiKeyRecord } from "@/lib/gateway/types";
import { formatAccountDate, formatOrgRole } from "@/lib/settings/founder-settings-copy";
import { buildWorkspaceSecuritySnapshot } from "@/lib/settings/trust-settings";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  createdAt: string | null;
  role: string;
  canEdit: boolean;
}

interface UserProfileRow {
  full_name: string | null;
  email: string;
  created_at: string | null;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string | null;
}

interface MembershipRow {
  role: string;
  organizations: OrganizationRow | OrganizationRow[] | null;
}

function getDbClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

function resolveDisplayName(
  profileName: string | null | undefined,
  metadata: Record<string, unknown> | undefined
): string {
  if (profileName?.trim()) return profileName.trim();
  const metaName = metadata?.full_name ?? metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return "";
}

async function fetchAgentKeys(): Promise<AgentApiKeyRecord[]> {
  try {
    const response = await fetch("/api/gateway/keys");
    if (!response.ok) return [];
    const payload = (await response.json()) as { keys?: AgentApiKeyRecord[] };
    return payload.keys ?? [];
  } catch {
    return [];
  }
}

function SettingsPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell maxWidth="4xl">
      <div className="st-page">
        <PageHeader
          icon={Settings}
          title="Settings"
          description="Manage your Wave account, security, and workspace."
        />
        <SettingsTrustHeader />
        {children}
        <SettingsTrustFooter />
      </div>
    </PageShell>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [profileLastUpdated, setProfileLastUpdated] = useState<string | null>(null);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string>("Email");
  const [apiKeys, setApiKeys] = useState<AgentApiKeyRecord[]>([]);

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [initialWorkspaceName, setInitialWorkspaceName] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoadError(null);
    const supabase = getDbClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(authError?.message ?? "Could not load your account.");
    }

    setUserId(user.id);
    setEmail(user.email ?? null);
    setAccountCreatedAt(user.created_at ?? null);
    setProfileLastUpdated(user.updated_at ?? user.created_at ?? null);
    setPasswordUpdatedAt(user.updated_at ?? user.created_at ?? null);

    const provider = user.app_metadata?.provider;
    if (typeof provider === "string" && provider.length > 0) {
      setAuthProvider(provider === "google" ? "Google" : provider);
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("full_name, email, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    const profileRow = profile as UserProfileRow | null;
    const resolvedName = resolveDisplayName(profileRow?.full_name, user.user_metadata);
    setFullName(resolvedName);
    setInitialFullName(resolvedName);

    if (profileRow?.created_at) {
      setAccountCreatedAt(profileRow.created_at);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug, created_at)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const membershipRow = membership as MembershipRow | null;
    const org = membershipRow?.organizations ?? null;
    const orgRow = Array.isArray(org) ? org[0] : org;
    const role = membershipRow?.role ?? "member";
    const canEdit = role === "owner" || role === "admin";

    if (orgRow) {
      setWorkspace({
        id: orgRow.id,
        name: orgRow.name,
        slug: orgRow.slug,
        createdAt: orgRow.created_at,
        role,
        canEdit,
      });
      setWorkspaceName(orgRow.name);
      setInitialWorkspaceName(orgRow.name);
    } else {
      setWorkspace(null);
      setWorkspaceName("");
      setInitialWorkspaceName("");
    }

    const keys = await fetchAgentKeys();
    setApiKeys(keys);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSettings()
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load settings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  const workspaceSecurity = useMemo(
    () =>
      buildWorkspaceSecuritySnapshot({
        apiKeys,
        passwordUpdatedAt,
      }),
    [apiKeys, passwordUpdatedAt]
  );

  const profileDirty = fullName.trim() !== initialFullName.trim();
  const workspaceDirty =
    workspace?.canEdit && workspaceName.trim() !== initialWorkspaceName.trim();

  const handleSaveProfile = async (): Promise<boolean> => {
    if (!userId || !profileDirty) return false;

    setProfileSaving(true);
    setProfileError(null);

    const trimmed = fullName.trim();
    const supabase = getDbClient();

    const { error: updateError } = await supabase
      .from("users")
      .update({ full_name: trimmed || null })
      .eq("id", userId);

    if (updateError) {
      setProfileError(updateError.message);
      setProfileSaving(false);
      return false;
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: trimmed, name: trimmed },
    });

    if (metaError) {
      setProfileError(metaError.message);
      setProfileSaving(false);
      return false;
    }

    const now = new Date().toISOString();
    setInitialFullName(trimmed);
    setFullName(trimmed);
    setProfileLastUpdated(now);
    setProfileSaving(false);
    return true;
  };

  const handleSaveWorkspace = async () => {
    if (!workspace?.canEdit || !workspaceDirty) return;

    const trimmed = workspaceName.trim();
    if (!trimmed) {
      setWorkspaceError("Workspace name cannot be empty.");
      return;
    }

    setWorkspaceSaving(true);
    setWorkspaceMessage(null);
    setWorkspaceError(null);

    const supabase = getDbClient();
    const { error } = await supabase
      .from("organizations")
      .update({ name: trimmed })
      .eq("id", workspace.id);

    if (error) {
      setWorkspaceError(error.message);
      setWorkspaceSaving(false);
      return;
    }

    setInitialWorkspaceName(trimmed);
    setWorkspaceName(trimmed);
    setWorkspace({ ...workspace, name: trimmed });
    setWorkspaceMessage("Workspace updated.");
    setWorkspaceSaving(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error(err instanceof AuthError ? err.message : "Sign out failed.");
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <SettingsPageLayout>
        <div className="st-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading settings…
        </div>
      </SettingsPageLayout>
    );
  }

  if (loadError) {
    return (
      <SettingsPageLayout>
        <div className="ds-card ds-card-padded st-error">{loadError}</div>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout>
      <section className="ds-section fade-in-up" style={{ animationDelay: "0.05s" }}>
        <SettingsProfileCard
          fullName={fullName}
          email={email}
          accountCreatedAt={accountCreatedAt}
          lastUpdatedAt={profileLastUpdated}
          authProvider={authProvider}
          profileDirty={profileDirty}
          profileSaving={profileSaving}
          profileError={profileError}
          onNameChange={(value) => {
            setFullName(value);
            setProfileError(null);
          }}
          onSave={() => handleSaveProfile()}
        />
      </section>

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.08s" }}>
        <SettingsWorkspaceSecurityCard snapshot={workspaceSecurity} />
      </section>

      {workspace ? (
        <section className="ds-section fade-in-up" style={{ animationDelay: "0.12s" }}>
          <SectionHeader
            title="Workspace"
            icon={Building2}
            description="Your Wave workspace and membership."
          />
          <div className="ds-panel st-workspace-panel">
            <div className="st-fields">
              <div className="st-field">
                <label htmlFor="settings-workspace-name" className="ds-label">
                  Workspace name
                </label>
                <input
                  id="settings-workspace-name"
                  type="text"
                  className="ds-input w-full"
                  value={workspaceName}
                  onChange={(event) => {
                    setWorkspaceName(event.target.value);
                    setWorkspaceMessage(null);
                    setWorkspaceError(null);
                  }}
                  readOnly={!workspace.canEdit}
                  aria-readonly={!workspace.canEdit}
                />
                {!workspace.canEdit ? (
                  <p className="st-field-hint">
                    Only workspace owners and admins can rename the workspace.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="st-info-grid">
              <div>
                <p className="st-info-label">Workspace settings</p>
                <p className="st-info-value">Slug: {workspace.slug}</p>
              </div>
              <div>
                <p className="st-info-label">Your role</p>
                <p className="st-info-value">{formatOrgRole(workspace.role)}</p>
              </div>
              <div>
                <p className="st-info-label">Created</p>
                <p className="st-info-value">{formatAccountDate(workspace.createdAt)}</p>
              </div>
            </div>

            {workspaceError ? <p className="st-form-error">{workspaceError}</p> : null}
            {workspaceMessage ? <p className="st-form-success">{workspaceMessage}</p> : null}

            {workspace.canEdit ? (
              <div className="st-actions">
                <Button
                  variant="primary"
                  onClick={() => void handleSaveWorkspace()}
                  loading={workspaceSaving}
                  disabled={!workspaceDirty}
                >
                  Save workspace
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.16s" }}>
        <SettingsNotificationsPanel email={email} />
      </section>

      <section className="ds-section fade-in-up" style={{ animationDelay: "0.2s" }}>
        <SettingsSecurityDashboard
          apiKeys={apiKeys}
          passwordChangedDaysAgo={workspaceSecurity.passwordChangedDaysAgo}
          signingOut={signingOut}
          onSignOut={() => void handleSignOut()}
        />
      </section>
    </SettingsPageLayout>
  );
}
