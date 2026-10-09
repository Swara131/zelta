import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskSeverity } from "@/lib/risk-types";
import type { EmailTemplatePayload } from "@/lib/email/types";
import { DEFAULT_MAX_RETRIES } from "@/lib/email/env";
import { EmailNotificationError } from "@/lib/email/errors";
import type { NotificationRow } from "@/lib/email/repository";
import type { ApprovalChannelPreferencesRow } from "@/lib/settings/approval-channels";

export interface ReviewerWithChannels {
  id: string;
  email: string;
  full_name: string | null;
  approval_email_enabled: boolean;
  approval_whatsapp_enabled: boolean;
  approval_dashboard_enabled: boolean;
  whatsapp_phone_e164: string | null;
  whatsapp_phone_verified_at: string | null;
}

export async function getUserApprovalChannels(
  supabase: SupabaseClient,
  userId: string
): Promise<ApprovalChannelPreferencesRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(
      "approval_email_enabled, approval_whatsapp_enabled, approval_dashboard_enabled, whatsapp_phone_e164, whatsapp_phone_verified_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ApprovalChannelPreferencesRow | null) ?? null;
}

export async function updateUserApprovalChannels(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<{
    approval_email_enabled: boolean;
    approval_whatsapp_enabled: boolean;
    approval_dashboard_enabled: boolean;
  }>
): Promise<ApprovalChannelPreferencesRow> {
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select(
      "approval_email_enabled, approval_whatsapp_enabled, approval_dashboard_enabled, whatsapp_phone_e164, whatsapp_phone_verified_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update approval channels.");
  }

  return data as ApprovalChannelPreferencesRow;
}

export async function getOrgReviewersWithChannels(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ReviewerWithChannels[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "user_id, role, users(id, email, full_name, approval_email_enabled, approval_whatsapp_enabled, approval_dashboard_enabled, whatsapp_phone_e164, whatsapp_phone_verified_at)"
    )
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin", "member"]);

  if (error) {
    throw new EmailNotificationError(error.message);
  }

  const reviewers: ReviewerWithChannels[] = [];

  for (const row of data ?? []) {
    const nested = row.users as ReviewerWithChannels | ReviewerWithChannels[] | null;
    const user = Array.isArray(nested) ? nested[0] : nested;
    if (user?.email) {
      reviewers.push(user);
    }
  }

  const unique = new Map<string, ReviewerWithChannels>();
  for (const reviewer of reviewers) {
    unique.set(reviewer.id, reviewer);
  }

  return [...unique.values()];
}

export async function findGatewayReviewWhatsAppNotification(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    recipientPhone: string;
  }
): Promise<NotificationRow | null> {
  const { data: active, error: activeError } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("template_type", "gateway_review_requested")
    .eq("risk_id", params.proposalId)
    .eq("recipient_phone", params.recipientPhone)
    .eq("channel", "whatsapp")
    .in("delivery_status", ["pending", "delivered", "retrying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw new EmailNotificationError(activeError.message);
  }

  return (active as NotificationRow | null) ?? null;
}

export async function createWhatsAppNotificationRecord(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    approvalRequestId?: string | null;
    riskTitle: string;
    riskId?: string | null;
    severity: RiskSeverity;
    recipient: string;
    recipientPhone: string;
    subject: string;
    preview: string;
    templatePayload: EmailTemplatePayload["gateway_review_requested"];
  }
): Promise<NotificationRow> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      approval_request_id: params.approvalRequestId ?? null,
      risk_title: params.riskTitle,
      risk_id: params.riskId ?? null,
      severity: params.severity,
      channel: "whatsapp",
      delivery_status: "pending",
      recipient: params.recipient,
      recipient_email: null,
      recipient_phone: params.recipientPhone,
      subject: params.subject,
      preview: params.preview,
      template_type: "gateway_review_requested",
      template_payload: params.templatePayload,
      retry_count: 0,
      max_retries: DEFAULT_MAX_RETRIES,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new EmailNotificationError(error?.message ?? "Failed to create WhatsApp notification.");
  }

  return data as NotificationRow;
}
