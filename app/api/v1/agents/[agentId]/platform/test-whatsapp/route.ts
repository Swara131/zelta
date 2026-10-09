import { destinationPhoneFromAgent } from "@/lib/agents/runtime/execution-plan";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { assertWhatsAppCanSend, sendWhatsAppText } from "@/lib/whatsapp/client";
import {
  isTwilioWhatsAppConfigured,
  isWhatsAppContentTemplateConfigured,
  requiresWhatsAppContentTemplate,
} from "@/lib/whatsapp/env";
import { maskPhoneDisplay, normalizeWhatsAppRecipient } from "@/lib/whatsapp/phone";
import { WhatsAppPhoneError } from "@/lib/whatsapp/errors";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const testWhatsAppSchema = z.object({
  recipientPhone: z.string().trim().min(8).max(20).optional(),
});

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim() ?? "";
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: normalizedSlug,
  });
  if (!agent) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  if (!isTwilioWhatsAppConfigured()) {
    return secureJson(
      {
        success: false,
        error: "WhatsApp delivery isn't connected yet.",
        fix: "Connect Twilio WhatsApp in Settings, then retry.",
      },
      { status: 503 }
    );
  }

  try {
    if (requiresWhatsAppContentTemplate() && !isWhatsAppContentTemplateConfigured()) {
      assertWhatsAppCanSend();
    }

    const body = await parseJsonBody(request, testWhatsAppSchema);

    let recipient: string;
    try {
      recipient = body.recipientPhone?.trim()
        ? normalizeWhatsAppRecipient(body.recipientPhone)
        : destinationPhoneFromAgent(agent)
          ? normalizeWhatsAppRecipient(destinationPhoneFromAgent(agent) ?? "")
          : "";
      if (!recipient) {
        return secureJson(
          {
            success: false,
            error: "Enter a WhatsApp number or save one while preparing the agent.",
          },
          { status: 400 }
        );
      }
    } catch (err) {
      const message =
        err instanceof WhatsAppPhoneError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invalid phone number.";
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    const result = await sendWhatsAppText({
      toE164: recipient,
      body: `Wave test from ${agent.name}. If you received this, WhatsApp delivery is working.`,
    });

    const recordedAt = new Date().toISOString();
    await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: {
        safetySettings: {
          ...agent.safetySettings,
          lastChannelTests: {
            ...(agent.safetySettings as { lastChannelTests?: Record<string, unknown> })
              .lastChannelTests,
            whatsapp: {
              ok: true,
              to: maskPhoneDisplay(recipient),
              messageId: result.messageId,
              at: recordedAt,
            },
          },
        },
      },
    });

    return secureJson({
      success: true,
      messageId: result.messageId,
      recipientMasked: maskPhoneDisplay(recipient),
      sentAt: recordedAt,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "WhatsApp test failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
