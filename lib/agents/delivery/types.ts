/** `notification` = legacy in-app alert; `whatsapp` = Twilio WhatsApp delivery. */
export type AgentDeliveryMode = "email" | "whatsapp" | "notification" | "both" | "none";

export type RunDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface AgentDeliverySettings {
  mode: AgentDeliveryMode;
  destinationEmail?: string | null;
  /** E.164 WhatsApp recipient, e.g. +919876543210 */
  destinationPhone?: string | null;
}

export interface RunDeliveryChannelResult {
  status: RunDeliveryStatus;
  destination?: string | null;
  sentAt?: string | null;
  error?: string | null;
  notificationId?: string | null;
  providerMessageId?: string | null;
}

export interface RunDeliveryRecord {
  mode: AgentDeliveryMode;
  status: RunDeliveryStatus;
  destination?: string | null;
  sentAt?: string | null;
  error?: string | null;
  email?: RunDeliveryChannelResult;
  notification?: RunDeliveryChannelResult;
  whatsapp?: RunDeliveryChannelResult;
  runId?: string | null;
  agentId?: string | null;
  createdAt?: string | null;
}
