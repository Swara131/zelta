import type { SupabaseClient } from "@supabase/supabase-js";
import { displayName, getUserById } from "@/lib/email/repository";
import { sendHtmlEmail } from "@/lib/email/resend-client";
import { renderEmailTemplate } from "@/lib/email/templates/render";
import { createAgentResultNotification } from "@/lib/email/agent-result-notification";
import {
  formatResendDeliveryError,
  getResendConfigStatus,
} from "@/lib/email/resend-config";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import type { RuntimeActivityLogger } from "../runtime/activity/activity-logger";
import type { LoadedAgent } from "../runtime/types";
import { destinationEmailFromAgent } from "../runtime/execution-plan";
import { splitAgentResultForDelivery } from "./format-result";
import {
  destinationEmailError,
  destinationPhoneError,
  isWhatsAppDeliveryConnected,
  parseDeliverySettings,
  resolveDestinationEmail,
  resolveDestinationPhone,
  shouldDeliverEmail,
  shouldDeliverForRunMode,
  shouldDeliverInAppNotification,
  shouldDeliverWhatsApp,
} from "./settings";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { maskPhoneDisplay } from "@/lib/whatsapp/phone";
import type {
  AgentDeliveryMode,
  RunDeliveryChannelResult,
  RunDeliveryRecord,
} from "./types";

export interface DeliverAgentResultParams {
  admin: SupabaseClient;
  agent: LoadedAgent;
  userId: string;
  userEmail: string;
  runId: string | null;
  runMode: string | undefined;
  summary: string;
  activity: RuntimeActivityLogger;
  /** When false, WhatsApp delivery is skipped (e.g. CRM update failed). */
  allowWhatsApp?: boolean;
  /** Optional override for WhatsApp body (e.g. ticket-resolved template). */
  whatsappBody?: string;
}

function emptyChannel(status: RunDeliveryChannelResult["status"]): RunDeliveryChannelResult {
  return { status };
}

function recordDeliveryAudit(
  admin: SupabaseClient,
  params: {
    organizationId: string;
    agentId: string | null;
    runId: string | null;
    builderAgentId: string;
    event: "runtime.delivery.started" | "runtime.delivery.sent" | "runtime.delivery.failed";
    metadata?: Record<string, unknown>;
  }
): void {
  recordRuntimeAuditEventAsync(admin, {
    organizationId: params.organizationId,
    event: params.event,
    agentId: params.agentId,
    metadata: {
      agentRunId: params.runId,
      builderAgentId: params.builderAgentId,
      ...params.metadata,
    },
  });
}

async function sendEmailDelivery(
  admin: SupabaseClient,
  params: DeliverAgentResultParams & { destinationEmail: string; recipientName: string }
): Promise<RunDeliveryChannelResult> {
  const resendStatus = getResendConfigStatus();
  if (!resendStatus.configured) {
    return {
      status: "failed",
      destination: params.destinationEmail,
      error: resendStatus.error ?? "Email delivery is not connected. Add RESEND_API_KEY in Settings.",
    };
  }

  const { summaryBody, sources } = splitAgentResultForDelivery(params.summary);
  const runAt = new Date().toISOString();

  const rendered = renderEmailTemplate("agent_result", {
    agentName: params.agent.record.name,
    agentSlug: params.agent.record.slug,
    summary: summaryBody || params.summary,
    sources,
    recipientName: params.recipientName,
    runMode: params.runMode ?? "manual",
    runAt,
    timezone: params.agent.record.timezone ?? "Asia/Kolkata",
  });

  recordDeliveryAudit(admin, {
    organizationId: params.agent.record.organizationId,
    agentId: params.agent.gatewayAgentId,
    runId: params.runId,
    builderAgentId: params.agent.record.id,
    event: "runtime.delivery.started",
    metadata: {
      channel: "email",
      destination: params.destinationEmail,
      mode: params.runMode ?? "manual",
    },
  });

  try {
    const { messageId } = await sendHtmlEmail({
      to: params.destinationEmail,
      subject: rendered.subject,
      html: rendered.html,
    });

    console.log("[delivery] email sent", {
      agent: params.agent.record.slug,
      to: params.destinationEmail,
      runMode: params.runMode ?? "manual",
      messageId,
    });

    recordDeliveryAudit(admin, {
      organizationId: params.agent.record.organizationId,
      agentId: params.agent.gatewayAgentId,
      runId: params.runId,
      builderAgentId: params.agent.record.id,
      event: "runtime.delivery.sent",
      metadata: {
        channel: "email",
        destination: params.destinationEmail,
        providerMessageId: messageId,
      },
    });

    return {
      status: "sent",
      destination: params.destinationEmail,
      sentAt: new Date().toISOString(),
      providerMessageId: messageId,
    };
  } catch (err) {
    const errorMessage = formatResendDeliveryError(
      err instanceof Error ? err.message : "Email delivery failed."
    );
    console.error("[delivery] email failed", {
      agent: params.agent.record.slug,
      to: params.destinationEmail,
      error: errorMessage,
    });

    recordDeliveryAudit(admin, {
      organizationId: params.agent.record.organizationId,
      agentId: params.agent.gatewayAgentId,
      runId: params.runId,
      builderAgentId: params.agent.record.id,
      event: "runtime.delivery.failed",
      metadata: {
        channel: "email",
        destination: params.destinationEmail,
        error: errorMessage,
      },
    });

    return {
      status: "failed",
      destination: params.destinationEmail,
      error: errorMessage,
    };
  }
}

async function sendWhatsAppDelivery(
  params: DeliverAgentResultParams & { destinationPhone: string }
): Promise<RunDeliveryChannelResult> {
  if (!isWhatsAppDeliveryConnected()) {
    return {
      status: "failed",
      destination: maskPhoneDisplay(params.destinationPhone),
      error:
        "WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env.local.",
    };
  }

  const body = params.whatsappBody?.trim() || params.summary;

  recordDeliveryAudit(params.admin, {
    organizationId: params.agent.record.organizationId,
    agentId: params.agent.gatewayAgentId,
    runId: params.runId,
    builderAgentId: params.agent.record.id,
    event: "runtime.delivery.started",
    metadata: {
      channel: "whatsapp",
      destination: maskPhoneDisplay(params.destinationPhone),
    },
  });

  try {
    const { messageId } = await sendWhatsAppText({
      toE164: params.destinationPhone,
      body,
    });

    recordDeliveryAudit(params.admin, {
      organizationId: params.agent.record.organizationId,
      agentId: params.agent.gatewayAgentId,
      runId: params.runId,
      builderAgentId: params.agent.record.id,
      event: "runtime.delivery.sent",
      metadata: {
        channel: "whatsapp",
        providerMessageId: messageId,
      },
    });

    return {
      status: "sent",
      destination: maskPhoneDisplay(params.destinationPhone),
      sentAt: new Date().toISOString(),
      providerMessageId: messageId,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "WhatsApp delivery failed.";
    recordDeliveryAudit(params.admin, {
      organizationId: params.agent.record.organizationId,
      agentId: params.agent.gatewayAgentId,
      runId: params.runId,
      builderAgentId: params.agent.record.id,
      event: "runtime.delivery.failed",
      metadata: { channel: "whatsapp", error: errorMessage },
    });

    return {
      status: "failed",
      destination: maskPhoneDisplay(params.destinationPhone),
      error: errorMessage,
    };
  }
}

async function sendInAppDelivery(
  admin: SupabaseClient,
  params: DeliverAgentResultParams & { recipientName: string }
): Promise<RunDeliveryChannelResult> {
  try {
    const notification = await createAgentResultNotification(admin, {
      organizationId: params.agent.record.organizationId,
      userId: params.userId,
      agentId: params.agent.record.id,
      agentSlug: params.agent.record.slug,
      agentName: params.agent.record.name,
      summary: params.summary,
      recipientName: params.recipientName,
      runId: params.runId,
    });

    console.log("[delivery] notification sent", {
      agent: params.agent.record.slug,
      notificationId: notification.id,
    });

    return {
      status: "sent",
      destination: params.userEmail,
      sentAt: new Date().toISOString(),
      notificationId: notification.id,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Notification delivery failed.";
    console.error("[delivery] notification failed", {
      agent: params.agent.record.slug,
      error: errorMessage,
    });

    return {
      status: "failed",
      destination: params.userEmail,
      error: errorMessage,
    };
  }
}

function aggregateDelivery(
  mode: AgentDeliveryMode,
  email: RunDeliveryChannelResult | undefined,
  notification: RunDeliveryChannelResult | undefined,
  whatsapp: RunDeliveryChannelResult | undefined
): RunDeliveryRecord {
  const channels = [email, notification, whatsapp].filter(Boolean) as RunDeliveryChannelResult[];
  const required = channels.filter((channel) => channel.status !== "skipped");

  const allSent = required.length > 0 && required.every((channel) => channel.status === "sent");
  const anyFailed = required.some((channel) => channel.status === "failed");
  const errors = required
    .map((channel) => channel.error)
    .filter(Boolean)
    .join(" ");

  return {
    mode,
    status: allSent ? "sent" : anyFailed ? "failed" : "skipped",
    destination:
      whatsapp?.destination ?? email?.destination ?? notification?.destination ?? null,
    sentAt: allSent ? new Date().toISOString() : null,
    error: errors || null,
    email,
    notification,
    whatsapp,
  };
}

export async function deliverAgentRunResult(
  params: DeliverAgentResultParams
): Promise<RunDeliveryRecord> {
  const delivery = parseDeliverySettings(params.agent.record.safetySettings);
  const createdAt = new Date().toISOString();

  if (delivery.mode === "none" || !shouldDeliverForRunMode(params.runMode)) {
    return {
      mode: delivery.mode,
      status: "skipped",
      createdAt,
      runId: params.runId,
      agentId: params.agent.record.id,
    };
  }

  await params.activity.logRunStep({
    runId: params.runId,
    key: "delivery.start",
    label: "Preparing delivery",
    detail: delivery.mode,
  });

  const user = await getUserById(params.admin, params.userId);
  const recipientName = displayName(user);
  const destinationEmail =
    destinationEmailFromAgent(params.agent.record) ??
    resolveDestinationEmail({
      delivery,
    });

  let emailResult: RunDeliveryChannelResult | undefined;
  let notificationResult: RunDeliveryChannelResult | undefined;
  let whatsappResult: RunDeliveryChannelResult | undefined;
  const destinationPhone = resolveDestinationPhone({ delivery });
  const allowWhatsApp = params.allowWhatsApp !== false;

  if (shouldDeliverEmail(delivery.mode)) {
    if (!destinationEmail) {
      emailResult = {
        status: "failed",
        destination: null,
        error: destinationEmailError(delivery.mode),
      };
    } else {
      emailResult = await sendEmailDelivery(params.admin, {
        ...params,
        destinationEmail,
        recipientName,
      });
    }

    await params.activity.logRunStep({
      runId: params.runId,
      key: "delivery.email",
      label:
        emailResult.status === "sent"
          ? "Email sent ✓"
          : emailResult.status === "failed"
            ? "Email delivery failed"
            : "Email skipped",
      detail: emailResult.error ?? emailResult.destination ?? undefined,
      status: emailResult.status === "sent" ? "completed" : "failed",
    });
  } else {
    emailResult = emptyChannel("skipped");
  }

  if (shouldDeliverInAppNotification(delivery.mode)) {
    notificationResult = await sendInAppDelivery(params.admin, {
      ...params,
      recipientName,
    });

    await params.activity.logRunStep({
      runId: params.runId,
      key: "delivery.notification",
      label:
        notificationResult.status === "sent"
          ? "Wave notification sent ✓"
          : notificationResult.status === "failed"
            ? "Notification delivery failed"
            : "Notification skipped",
      detail: notificationResult.error ?? undefined,
      status: notificationResult.status === "sent" ? "completed" : "failed",
    });
  } else {
    notificationResult = emptyChannel("skipped");
  }

  if (shouldDeliverWhatsApp(delivery.mode)) {
    if (!allowWhatsApp) {
      whatsappResult = {
        status: "skipped",
        destination: destinationPhone ? maskPhoneDisplay(destinationPhone) : null,
        error: "Skipped because CRM update did not succeed.",
      };
    } else if (!destinationPhone) {
      whatsappResult = {
        status: "failed",
        destination: null,
        error: destinationPhoneError(delivery.mode),
      };
    } else {
      whatsappResult = await sendWhatsAppDelivery({
        ...params,
        destinationPhone,
      });
    }

    await params.activity.logRunStep({
      runId: params.runId,
      key: "delivery.whatsapp",
      label:
        whatsappResult.status === "sent"
          ? "WhatsApp sent ✓"
          : whatsappResult.status === "failed"
            ? "WhatsApp delivery failed"
            : "WhatsApp skipped",
      detail: whatsappResult.error ?? whatsappResult.destination ?? undefined,
      status: whatsappResult.status === "sent" ? "completed" : "failed",
    });
  } else {
    whatsappResult = emptyChannel("skipped");
  }

  const record = aggregateDelivery(
    delivery.mode,
    emailResult,
    notificationResult,
    whatsappResult
  );

  const deliveryLog: RunDeliveryRecord = {
    ...record,
    runId: params.runId,
    agentId: params.agent.record.id,
    createdAt,
  };

  await params.activity.logRunStep({
    runId: params.runId,
    key: "delivery.finish",
    label: record.status === "sent" ? "Delivery complete" : "Delivery failed",
    detail: record.error ?? record.destination ?? undefined,
    status: record.status === "sent" ? "completed" : "failed",
  });

  return deliveryLog;
}
