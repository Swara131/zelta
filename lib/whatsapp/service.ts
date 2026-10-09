import type { SupabaseClient } from "@supabase/supabase-js";
import { updateNotificationDelivery } from "@/lib/email/repository";
import type { NotificationRow } from "@/lib/email/repository";
import { renderWhatsAppApprovalRequest } from "./templates/approval-request";
import { sendWhatsAppText } from "./client";
import { WhatsAppSendError } from "./errors";

/** Delivers a queued WhatsApp notification record (retry-safe). */
export async function deliverWhatsAppNotification(
  supabase: SupabaseClient,
  notification: NotificationRow
): Promise<void> {
  if (notification.channel !== "whatsapp") {
    throw new WhatsAppSendError("Notification is not a WhatsApp channel record.");
  }

  if (!notification.recipient_phone) {
    throw new WhatsAppSendError("Notification is missing recipient phone.");
  }

  const payload = notification.template_payload as {
    agentId?: string;
    toolName?: string;
    actionType?: string;
    actionPayload?: Record<string, unknown>;
    riskLevel?: string;
    riskScore?: number;
    approveUrl?: string;
    rejectUrl?: string;
    approvalsUrl?: string;
  };

  if (
    !payload.agentId ||
    !payload.toolName ||
    !payload.actionType ||
    payload.riskScore == null ||
    !payload.approveUrl ||
    !payload.rejectUrl ||
    !payload.approvalsUrl
  ) {
    throw new WhatsAppSendError("WhatsApp notification is missing template data.");
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

  const rendered = renderWhatsAppApprovalRequest({
    agentId: payload.agentId,
    toolName: payload.toolName,
    actionType: payload.actionType,
    actionPayload: payload.actionPayload,
    riskLevel: (payload.riskLevel as "low" | "medium" | "high" | "critical") ?? "medium",
    riskScore: payload.riskScore,
    approveUrl: payload.approveUrl,
    rejectUrl: payload.rejectUrl,
    reviewUrl: payload.approvalsUrl,
  });

  try {
    const { messageId } = await sendWhatsAppText({
      toE164: notification.recipient_phone,
      body: rendered.body,
    });

    await updateNotificationDelivery(supabase, notification.id, {
      delivery_status: "delivered",
      provider_message_id: messageId,
      last_error: null,
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof WhatsAppSendError ? err.message : "WhatsApp send failed.";
    const retryCount = notification.retry_count + 1;
    const isExhausted = retryCount >= notification.max_retries;

    await updateNotificationDelivery(supabase, notification.id, {
      delivery_status: isExhausted ? "bounced" : "failed",
      last_error: message,
      retry_count: retryCount,
    });

    throw new WhatsAppSendError(message);
  }
}
