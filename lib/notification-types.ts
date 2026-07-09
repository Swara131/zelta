import type { RiskSeverity } from "./risk-types";

export type NotificationChannel = "email" | "slack" | "teams";
export type NotificationStatus = "unread" | "read" | "archived";
export type DeliveryStatus = "delivered" | "pending" | "failed" | "bounced" | "retrying";

export interface NotificationItem {
  id: string;
  risk: string;
  riskId: string;
  timestamp: string;
  severity: RiskSeverity;
  status: NotificationStatus;
  recipient: string;
  recipientEmail?: string;
  channel: NotificationChannel;
  deliveryStatus: DeliveryStatus;
  subject: string;
  preview: string;
  retryCount: number;
  maxRetries: number;
}

export type NotificationTab = "unread" | "all" | "email" | "slack" | "teams";
