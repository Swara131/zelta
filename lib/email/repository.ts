import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskSeverity } from "@/lib/risk-types";
import type { EmailTemplatePayload, EmailTemplateType } from "./types";
import { DEFAULT_MAX_RETRIES } from "./env";
import { EmailNotificationError } from "./errors";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  approval_request_id: string | null;
  risk_analysis_id: string | null;
  risk_title: string;
  risk_id: string | null;
  severity: RiskSeverity;
  status: string;
  channel: string;
  delivery_status: string;
  recipient: string;
  recipient_email: string | null;
  subject: string;
  preview: string;
  retry_count: number;
  max_retries: number;
  template_type: string | null;
  template_payload: EmailTemplatePayload[EmailTemplateType];
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

type UserRow = { id: string; email: string; full_name: string | null };

export function displayName(user: UserRow | null | undefined): string {
  if (!user) return "User";
  return user.full_name?.trim() || user.email.split("@")[0] || "User";
}

export async function getUserById(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  return (data as UserRow | null) ?? null;
}

export async function getOrgReviewerEmails(
  supabase: SupabaseClient,
  organizationId: string
): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, users(id, email, full_name)")
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin", "member"]);

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  const users: UserRow[] = [];

  for (const row of data ?? []) {
    const nested = row.users as UserRow | UserRow[] | null;
    const user = Array.isArray(nested) ? nested[0] : nested;
    if (user?.email) {
      users.push(user);
    }
  }

  const unique = new Map<string, UserRow>();
  for (const user of users) {
    unique.set(user.id, user);
  }

  return [...unique.values()];
}

export async function createNotificationRecord(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    approvalRequestId?: string | null;
    riskAnalysisId?: string | null;
    riskTitle: string;
    riskId?: string | null;
    severity: RiskSeverity;
    recipient: string;
    recipientEmail: string;
    subject: string;
    preview: string;
    templateType: EmailTemplateType;
    templatePayload: EmailTemplatePayload[EmailTemplateType];
  }
): Promise<NotificationRow> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      approval_request_id: params.approvalRequestId ?? null,
      risk_analysis_id: params.riskAnalysisId ?? null,
      risk_title: params.riskTitle,
      risk_id: params.riskId ?? null,
      severity: params.severity,
      channel: "email",
      delivery_status: "pending",
      recipient: params.recipient,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      preview: params.preview,
      template_type: params.templateType,
      template_payload: params.templatePayload,
      retry_count: 0,
      max_retries: DEFAULT_MAX_RETRIES,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new EmailNotificationError(error?.message ?? "Failed to create notification.");
  }

  return data as NotificationRow;
}

export async function updateNotificationDelivery(
  supabase: SupabaseClient,
  notificationId: string,
  patch: {
    delivery_status: string;
    provider_message_id?: string | null;
    last_error?: string | null;
    sent_at?: string | null;
    retry_count?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update(patch)
    .eq("id", notificationId);

  if (error) {
    throw new EmailNotificationError(error.message);
  }
}

export async function getNotificationById(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .maybeSingle();

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  return (data as NotificationRow | null) ?? null;
}

export async function listUserNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 100
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  return (data ?? []) as NotificationRow[];
}

export async function updateNotificationReadStatus(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string,
  status: "read" | "archived"
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ status })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new EmailNotificationError(error.message);
  }
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("user_id", userId)
    .eq("status", "unread");

  if (error) {
    throw new EmailNotificationError(error.message);
  }
}

export async function listRetryableNotifications(
  supabase: SupabaseClient,
  limit = 25
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("channel", "email")
    .in("delivery_status", ["failed", "bounced"])
    .order("created_at", { ascending: true })
    .limit(limit * 3);

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  return ((data ?? []) as NotificationRow[])
    .filter((row) => row.retry_count < row.max_retries)
    .slice(0, limit);
}
