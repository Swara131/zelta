import {
  allowWhatsAppDevLogFallback,
  getTwilioAccountSid,
  getTwilioAuthToken,
  getTwilioMessagingServiceSid,
  getTwilioWhatsAppContentSid,
  getTwilioWhatsAppFrom,
  isTwilioWhatsAppConfigured,
  requiresWhatsAppContentTemplate,
  shouldUseWhatsAppContentTemplate,
} from "./env";
import { WhatsAppSendError } from "./errors";
import { buildWhatsAppContentVariables } from "./content-template";
import type { SupportTicketInput } from "@/lib/agents/crm/types";

export interface WhatsAppSendResult {
  messageId: string;
  provider: "twilio" | "dev_log";
}

export interface WhatsAppSendParams {
  toE164: string;
  body: string;
  /** When provided, ticket fields can map into numbered template variables. */
  ticket?: SupportTicketInput;
}

function toWhatsAppAddress(e164: string): string {
  return e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
}

interface TwilioMessageResponse {
  sid?: string;
  message?: string;
  code?: number;
}

function contentSidRequiredHelp(): string {
  return [
    "Twilio Trial cannot send WhatsApp from a business number (Content Templates are paid-only).",
    "Messages are sent through the Twilio WhatsApp Sandbox (+1 415 523 8886).",
    "On the recipient phone, open WhatsApp and join the sandbox: Twilio Console → Messaging → Try WhatsApp → send the join code to +1 415 523 8886.",
    "Then click Send Test WhatsApp again.",
  ].join(" ");
}

function mapTwilioSendError(payload: TwilioMessageResponse): string {
  const code = Number(payload.code);
  const message = payload.message ?? "Failed to send WhatsApp message.";

  if (code === 63015 || code === 63016 || /not.*(sandbox|opt.?in)/i.test(message)) {
    return [
      "WhatsApp sandbox is connected, but this phone has not joined it yet.",
      "On that phone, open WhatsApp → message +1 415 523 8886 with the join code from Twilio Console → Messaging → Try WhatsApp.",
      "Then retry Send Test WhatsApp.",
    ].join(" ");
  }

  if (isContentSidRequiredError(payload)) {
    return contentSidRequiredHelp();
  }

  return message;
}

function isContentSidRequiredError(payload: TwilioMessageResponse): boolean {
  const message = payload.message?.toLowerCase() ?? "";
  const code = Number(payload.code);
  return (
    code === 21654 ||
    code === 92005 ||
    message.includes("contentsid") ||
    message.includes("content sid")
  );
}

export function whatsAppContentTemplateSetupError(): string {
  return contentSidRequiredHelp();
}

export function assertWhatsAppCanSend(): void {
  if (requiresWhatsAppContentTemplate() && !shouldUseWhatsAppContentTemplate()) {
    throw new WhatsAppSendError(contentSidRequiredHelp());
  }
}

async function postTwilioMessage(
  accountSid: string,
  authToken: string,
  fields: Record<string, string>
): Promise<WhatsAppSendResult> {
  const body = new URLSearchParams(fields);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  const payload = (await response.json()) as TwilioMessageResponse;

  if (!response.ok) {
    if (isContentSidRequiredError(payload)) {
      throw new WhatsAppSendError(contentSidRequiredHelp());
    }
    throw new WhatsAppSendError(mapTwilioSendError(payload));
  }

  if (!payload.sid) {
    throw new WhatsAppSendError("Twilio did not return a message id.");
  }

  return { messageId: payload.sid, provider: "twilio" };
}

async function sendViaContentTemplate(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  const contentSid = getTwilioWhatsAppContentSid();
  if (!contentSid) {
    throw new WhatsAppSendError(contentSidRequiredHelp());
  }

  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const from = getTwilioWhatsAppFrom();
  const to = toWhatsAppAddress(params.toE164);
  const messagingServiceSid = getTwilioMessagingServiceSid();

  const contentVariables = buildWhatsAppContentVariables({
    body: params.body,
    ticket: params.ticket,
  });

  const fields: Record<string, string> = {
    From: from,
    To: to,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(contentVariables),
  };

  if (messagingServiceSid) {
    fields.MessagingServiceSid = messagingServiceSid;
  }

  return postTwilioMessage(accountSid, authToken, fields);
}

async function sendViaBody(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  const from = getTwilioWhatsAppFrom();
  const to = toWhatsAppAddress(params.toE164);

  return postTwilioMessage(accountSid, authToken, {
    From: from,
    To: to,
    Body: params.body,
  });
}

export async function sendWhatsAppText(params: WhatsAppSendParams): Promise<WhatsAppSendResult> {
  if (!isTwilioWhatsAppConfigured()) {
    if (allowWhatsAppDevLogFallback()) {
      console.info("[whatsapp][dev]", params.toE164, params.body);
      return { messageId: `dev_${Date.now()}`, provider: "dev_log" };
    }

    throw new WhatsAppSendError(
      "WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env.local."
    );
  }

  assertWhatsAppCanSend();

  if (shouldUseWhatsAppContentTemplate()) {
    return sendViaContentTemplate(params);
  }

  return sendViaBody(params);
}
