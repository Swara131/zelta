import type {
  NotificationChannel,
  NotificationItem,
} from "@/lib/notification-types";
import type { NotificationRow } from "./repository";

function mapDeliveryStatus(
  status: string
): NotificationItem["deliveryStatus"] {
  if (
    status === "delivered" ||
    status === "pending" ||
    status === "failed" ||
    status === "bounced" ||
    status === "retrying"
  ) {
    return status;
  }
  return "pending";
}

function mapReadStatus(status: string): NotificationItem["status"] {
  if (status === "read" || status === "archived") return status;
  return "unread";
}

function mapChannel(channel: string): NotificationChannel {
  if (channel === "slack" || channel === "teams") return channel;
  return "email";
}

export function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    risk: row.risk_title,
    riskId: row.risk_id ?? row.id,
    timestamp: row.sent_at ?? row.created_at,
    severity: row.severity,
    status: mapReadStatus(row.status),
    recipient: row.recipient,
    recipientEmail: row.recipient_email ?? undefined,
    channel: mapChannel(row.channel),
    deliveryStatus: mapDeliveryStatus(row.delivery_status),
    subject: row.subject,
    preview: row.preview,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
  };
}
