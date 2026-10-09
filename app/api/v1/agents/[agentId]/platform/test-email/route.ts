import { destinationEmailFromAgent } from "@/lib/agents/runtime/execution-plan";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { EmailSendError, sendHtmlEmail } from "@/lib/email/resend-client";
import {
  formatResendDeliveryError,
  getResendConfigStatus,
} from "@/lib/email/resend-config";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const testEmailSchema = z.object({
  to: z.string().trim().email().optional(),
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
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: slug?.trim() ?? "",
  });
  if (!agent) {
    return secureJson({ success: false, error: "Agent not found." }, { status: 404 });
  }

  const resend = getResendConfigStatus();
  if (!resend.configured) {
    return secureJson(
      {
        success: false,
        error: resend.error ?? "Email delivery isn't connected yet.",
        fix: "Add RESEND_API_KEY and a verified RESEND_FROM_EMAIL, then retry.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await parseJsonBody(request, testEmailSchema);
    const to = body.to?.trim() || destinationEmailFromAgent(agent);
    if (!to || !EMAIL_PATTERN.test(to)) {
      return secureJson(
        { success: false, error: "Enter a valid email address before sending a test." },
        { status: 400 }
      );
    }

    const sent = await sendHtmlEmail({
      to,
      subject: `${agent.name} test email`,
      html: `<p>This is a live test from Wave for <strong>${agent.name}</strong>.</p><p>If you received this, email delivery is working.</p>`,
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
            email: {
              ok: true,
              to,
              messageId: sent.messageId,
              at: recordedAt,
            },
          },
        },
      },
    });

    return secureJson({
      success: true,
      to,
      messageId: sent.messageId,
      sentAt: recordedAt,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }
    const raw = err instanceof EmailSendError || err instanceof Error ? err.message : "Email could not be sent.";
    const message = formatResendDeliveryError(raw);
    return secureJson(
      {
        success: false,
        error: message,
        reason: raw,
        fix: "Check the recipient, Resend domain verification, and API key, then retry.",
      },
      { status: 502 }
    );
  }
}
