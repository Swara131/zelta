import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuilderAgentRecord } from "@/lib/agents/runtime-types";
import {
  parseDeliverySettings,
  resolveDestinationPhone,
  shouldDeliverWhatsApp,
} from "@/lib/agents/delivery/settings";
import { insertCrmUpdate } from "./repository";
import type { CrmWhatsAppFlowResult, SupportTicketInput } from "./types";
import { validateSupportTicketInput } from "./validate-ticket";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { renderTicketResolvedWhatsApp } from "@/lib/whatsapp/templates/ticket-resolved";
import { maskPhoneDisplay, normalizeWhatsAppRecipient } from "@/lib/whatsapp/phone";
import { isTwilioWhatsAppConfigured } from "@/lib/whatsapp/env";
import { WhatsAppSendError } from "@/lib/whatsapp/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendTicketResolvedWhatsApp(params: {
  ticket: SupportTicketInput;
  recipientPhone: string;
}): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  try {
    const toE164 = normalizeWhatsAppRecipient(params.recipientPhone);
    const body = renderTicketResolvedWhatsApp(params.ticket);
    const { messageId } = await sendWhatsAppText({ toE164, body, ticket: params.ticket });
    return { success: true, messageId };
  } catch (err) {
    const message =
      err instanceof WhatsAppSendError
        ? err.message
        : err instanceof Error
          ? err.message
          : "WhatsApp notification failed.";
    return { success: false, error: message };
  }
}

/** CRM update then optional WhatsApp — WhatsApp only runs after CRM succeeds. */
export async function runSupportTicketFlow(
  supabase: SupabaseClient,
  params: {
    agent: BuilderAgentRecord;
    userId: string;
    ticket: Partial<SupportTicketInput>;
    agentRunId?: string | null;
    forceWhatsApp?: boolean;
    overrideRecipient?: string | null;
  }
): Promise<CrmWhatsAppFlowResult> {
  const validation = validateSupportTicketInput(params.ticket);
  if (!validation.valid) {
    return {
      crm: { success: false, error: validation.error },
      whatsapp: null,
    };
  }

  const ticket = validation.ticket;

  try {
    const admin = createAdminClient();
    const row = await insertCrmUpdate(admin, {
      agentId: params.agent.id,
      organizationId: params.agent.organizationId,
      userId: params.userId,
      agentRunId: params.agentRunId ?? null,
      ticket,
    });

    const crmResult = {
      success: true as const,
      updateId: row.id,
      ticket,
    };

    const delivery = parseDeliverySettings(params.agent.safetySettings);
    const wantsWhatsApp =
      params.forceWhatsApp ||
      shouldDeliverWhatsApp(delivery.mode) ||
      params.agent.tools.includes("send_whatsapp_message");

    if (!wantsWhatsApp) {
      return { crm: crmResult, whatsapp: null };
    }

    const recipient =
      params.overrideRecipient?.trim() ||
      resolveDestinationPhone({ delivery });

    if (!recipient) {
      return {
        crm: crmResult,
        whatsapp: {
          success: false,
          error: "Add a WhatsApp recipient number in notification settings.",
        },
      };
    }

    if (!isTwilioWhatsAppConfigured()) {
      return {
        crm: crmResult,
        whatsapp: {
          success: false,
          error:
            "WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env.local.",
          recipientMasked: maskPhoneDisplay(recipient),
        },
      };
    }

    const whatsappSend = await sendTicketResolvedWhatsApp({
      ticket,
      recipientPhone: recipient,
    });

    if (whatsappSend.success) {
      return {
        crm: crmResult,
        whatsapp: {
          success: true,
          messageId: whatsappSend.messageId,
          recipientMasked: maskPhoneDisplay(recipient),
        },
      };
    }

    return {
      crm: crmResult,
      whatsapp: {
        success: false,
        error: whatsappSend.error,
        recipientMasked: maskPhoneDisplay(recipient),
      },
    };
  } catch (err) {
    return {
      crm: {
        success: false,
        error: err instanceof Error ? err.message : "CRM update failed.",
        ticket,
      },
      whatsapp: null,
    };
  }
}

export function isCrmUpdaterAgent(agent: Pick<BuilderAgentRecord, "tools">): boolean {
  return agent.tools.includes("update_crm_record");
}
