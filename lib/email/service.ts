import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetectedRisk } from "@/lib/risk-types";
import { recordAuditAsync } from "@/lib/audit/logger";
import { EmailNotificationError } from "./errors";
import { sendHtmlEmail, EmailSendError } from "./resend-client";
import {
  createNotificationRecord,
  displayName,
  getNotificationById,
  getOrgReviewerEmails,
  getUserById,
  listRetryableNotifications,
  updateNotificationDelivery,
  type NotificationRow,
} from "./repository";
import { renderEmailTemplate } from "./templates/render";
import type { EmailTemplatePayload, EmailTemplateType } from "./types";

async function deliverNotification(
  supabase: SupabaseClient,
  notification: NotificationRow
): Promise<void> {
  const templateType = notification.template_type as EmailTemplateType | null;

  if (!templateType || !notification.template_payload) {
    throw new EmailNotificationError("Notification is missing template data for retry.");
  }

  if (!notification.recipient_email) {
    throw new EmailNotificationError("Notification is missing recipient email.");
  }

  const isRetry =
    notification.retry_count > 0 ||
    notification.delivery_status === "failed" ||
    notification.delivery_status === "bounced";

  if (isRetry) {
    await updateNotificationDelivery(supabase, notification.id, {
      delivery_status: "retrying",
    });
  }

  const rendered = renderEmailTemplate(
    templateType,
    notification.template_payload as EmailTemplatePayload[typeof templateType]
  );

  try {
    const { messageId } = await sendHtmlEmail({
      to: notification.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
    });

    await updateNotificationDelivery(supabase, notification.id, {
      delivery_status: "delivered",
      provider_message_id: messageId,
      last_error: null,
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : "Email send failed.";
    const retryCount = notification.retry_count + 1;
    const isExhausted = retryCount >= notification.max_retries;

    await updateNotificationDelivery(supabase, notification.id, {
      delivery_status: isExhausted ? "bounced" : "failed",
      last_error: message,
      retry_count: retryCount,
    });

    throw new EmailNotificationError(message);
  }
}

async function queueEmail<T extends EmailTemplateType>(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    recipientUser: { email: string; name: string };
    templateType: T;
    templatePayload: EmailTemplatePayload[T];
    severity: DetectedRisk["severity"];
    riskTitle: string;
    approvalRequestId?: string | null;
    riskAnalysisId?: string | null;
    riskId?: string | null;
  }
): Promise<void> {
  const rendered = renderEmailTemplate(params.templateType, params.templatePayload);

  const notification = await createNotificationRecord(supabase, {
    organizationId: params.organizationId,
    userId: params.userId,
    approvalRequestId: params.approvalRequestId,
    riskAnalysisId: params.riskAnalysisId,
    riskTitle: params.riskTitle,
    riskId: params.riskId,
    severity: params.severity,
    recipient: params.recipientUser.name,
    recipientEmail: params.recipientUser.email,
    subject: rendered.subject,
    preview: rendered.preview,
    templateType: params.templateType,
    templatePayload: params.templatePayload,
  });

  try {
    await deliverNotification(supabase, notification);

    recordAuditAsync(supabase, {
      userId: params.userId,
      organizationId: params.organizationId,
      action: "notify",
      entityType: "notification",
      entityId: notification.id,
      riskSeverity: params.severity,
      approvalStatus:
        params.templateType === "approval_approved"
          ? "approved"
          : params.templateType === "approval_rejected"
            ? "rejected"
            : params.templateType === "approval_requested" ||
                params.templateType === "gateway_review_requested"
              ? "pending"
              : null,
      metadata: {
        description: rendered.preview,
        templateType: params.templateType,
        recipient: params.recipientUser.email,
        subject: rendered.subject,
      },
    });
  } catch (err) {
    console.error(`Email delivery failed (${params.templateType}):`, err);
  }
}

/** Sends to org reviewers when human approval is required. */
export async function notifyApprovalRequested(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    requesterId: string;
    approvalRequestId: string;
    title: string;
    severity: DetectedRisk["severity"];
    agentId: string;
    requiredApprovals: number;
    slaDeadline: string;
    aiExplanation: string;
  }
): Promise<void> {
  const reviewers = await getOrgReviewerEmails(supabase, params.organizationId);

  if (reviewers.length === 0) {
    const requester = await getUserById(supabase, params.requesterId);
    if (!requester?.email) return;
    reviewers.push(requester);
  }

  await Promise.all(
    reviewers.map((reviewer) =>
      queueEmail(supabase, {
        organizationId: params.organizationId,
        userId: params.requesterId,
        recipientUser: { email: reviewer.email, name: displayName(reviewer) },
        templateType: "approval_requested",
        templatePayload: {
          approvalId: params.approvalRequestId,
          title: params.title,
          severity: params.severity,
          agentId: params.agentId,
          requiredApprovals: params.requiredApprovals,
          slaDeadline: params.slaDeadline,
          aiExplanation: params.aiExplanation,
          recipientName: displayName(reviewer),
        },
        severity: params.severity,
        riskTitle: params.title,
        approvalRequestId: params.approvalRequestId,
        riskId: params.approvalRequestId,
      })
    )
  );
}

export async function notifyApprovalApproved(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    requesterId: string;
    approvalRequestId: string;
    title: string;
    severity: DetectedRisk["severity"];
    agentId: string;
    actorName?: string;
    note?: string;
  }
): Promise<void> {
  const requester = await getUserById(supabase, params.requesterId);
  if (!requester?.email) return;

  await queueEmail(supabase, {
    organizationId: params.organizationId,
    userId: params.requesterId,
    recipientUser: { email: requester.email, name: displayName(requester) },
    templateType: "approval_approved",
    templatePayload: {
      approvalId: params.approvalRequestId,
      title: params.title,
      severity: params.severity,
      agentId: params.agentId,
      actorName: params.actorName,
      note: params.note,
      recipientName: displayName(requester),
    },
    severity: params.severity,
    riskTitle: params.title,
    approvalRequestId: params.approvalRequestId,
    riskId: params.approvalRequestId,
  });
}

export async function notifyApprovalRejected(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    requesterId: string;
    approvalRequestId: string;
    title: string;
    severity: DetectedRisk["severity"];
    agentId: string;
    actorName?: string;
    note?: string;
  }
): Promise<void> {
  const requester = await getUserById(supabase, params.requesterId);
  if (!requester?.email) return;

  await queueEmail(supabase, {
    organizationId: params.organizationId,
    userId: params.requesterId,
    recipientUser: { email: requester.email, name: displayName(requester) },
    templateType: "approval_rejected",
    templatePayload: {
      approvalId: params.approvalRequestId,
      title: params.title,
      severity: params.severity,
      agentId: params.agentId,
      actorName: params.actorName,
      note: params.note,
      recipientName: displayName(requester),
    },
    severity: params.severity,
    riskTitle: params.title,
    approvalRequestId: params.approvalRequestId,
    riskId: params.approvalRequestId,
  });
}

export async function notifyCriticalRiskDetected(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    riskAnalysisId: string;
    risk: DetectedRisk;
    overallScore: number;
  }
): Promise<void> {
  const recipients = await getOrgReviewerEmails(supabase, params.organizationId);
  const owner = await getUserById(supabase, params.userId);

  if (owner?.email && !recipients.some((r) => r.id === owner.id)) {
    recipients.unshift(owner);
  }

  if (recipients.length === 0 && owner?.email) {
    recipients.push(owner);
  }

  await Promise.all(
    recipients.map((recipient) =>
      queueEmail(supabase, {
        organizationId: params.organizationId,
        userId: params.userId,
        recipientUser: { email: recipient.email, name: displayName(recipient) },
        templateType: "critical_risk_detected",
        templatePayload: {
          riskAnalysisId: params.riskAnalysisId,
          title: params.risk.title,
          severity: "critical",
          overallScore: params.overallScore,
          explanation: params.risk.explanation,
          suggestedAction: params.risk.suggestedAction,
          recipientName: displayName(recipient),
        },
        severity: "critical",
        riskTitle: params.risk.title,
        riskAnalysisId: params.riskAnalysisId,
        riskId: params.risk.id,
      })
    )
  );
}

export async function retryNotification(
  supabase: SupabaseClient,
  notificationId: string,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  const notification = await getNotificationById(supabase, notificationId);

  if (!notification) {
    return { success: false, error: "Notification not found." };
  }

  if (notification.retry_count >= notification.max_retries) {
    return { success: false, error: "Maximum retries exceeded." };
  }

  if (!["failed", "bounced"].includes(notification.delivery_status)) {
    return { success: false, error: "Only failed notifications can be retried." };
  }

  try {
    await deliverNotification(supabase, notification);

    recordAuditAsync(supabase, {
      request,
      userId: notification.user_id,
      organizationId: notification.organization_id,
      action: "notify",
      entityType: "notification",
      entityId: notification.id,
      riskSeverity: notification.severity,
      metadata: {
        description: `Retried email delivery: "${notification.subject}"`,
        recipient: notification.recipient_email,
        retryCount: notification.retry_count + 1,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Retry failed.",
    };
  }
}

export async function retryFailedNotifications(
  supabase: SupabaseClient,
  limit = 25
): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const pending = await listRetryableNotifications(supabase, limit);
  let succeeded = 0;
  let failed = 0;

  for (const notification of pending) {
    const result = await retryNotification(supabase, notification.id);
    if (result.success) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return { attempted: pending.length, succeeded, failed };
}

/** Gateway REVIEW notification — sent to org reviewers via Resend. */
export async function notifyGatewayReviewRequiredEmail(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    recipientEmail: string;
    recipientName: string;
    proposalId: string;
    agentId: string;
    toolName: string;
    actionType: string;
    plainEnglishSummary: string;
    riskLevel: string;
    riskScore: number;
  }
): Promise<void> {
  const title = `${params.toolName} — ${params.actionType}`;

  await queueEmail(supabase, {
    organizationId: params.organizationId,
    userId: params.userId,
    recipientUser: {
      email: params.recipientEmail,
      name: params.recipientName,
    },
    templateType: "gateway_review_requested",
    templatePayload: {
      proposalId: params.proposalId,
      agentId: params.agentId,
      toolName: params.toolName,
      actionType: params.actionType,
      plainEnglishSummary: params.plainEnglishSummary,
      riskLevel: params.riskLevel,
      riskScore: params.riskScore,
      recipientName: params.recipientName,
    },
    severity: params.riskLevel as DetectedRisk["severity"],
    riskTitle: title,
    approvalRequestId: params.proposalId,
    riskId: params.proposalId,
  });
}
