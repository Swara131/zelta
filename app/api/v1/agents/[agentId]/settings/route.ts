import { isAgentDbStatusPaused } from "@/lib/agents/agent-mode";
import {
  isEmailDeliveryConnected,
  isWhatsAppDeliveryConnected,
  mergeDeliverySettings,
  parseDeliverySettings,
  validateDeliverySettings,
} from "@/lib/agents/delivery/settings";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { formatNextRunAt } from "@/lib/agents/scheduling/format-next-run";
import { syncAgentSchedule } from "@/lib/agents/scheduling/sync-agent-schedule";
import { normalizeAgentTimezone } from "@/lib/agents/scheduling/timezone";
import { ScheduleValidationError } from "@/lib/agents/scheduling/validate-schedule";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { updateAgentSettingsSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";
import {
  getResendConfigStatus,
  resendSandboxRecipientWarning,
} from "@/lib/email/resend-config";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  const { agentId: slug } = await context.params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    return secureError("Agent ID is required.", 400);
  }

  try {
    const body = await parseJsonBody(request, updateAgentSettingsSchema);

    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    if (!agent) {
      return secureJson({ error: "Agent not found." }, { status: 404 });
    }

    const delivery = {
      mode: body.deliveryMode,
      destinationEmail: body.destinationEmail ?? null,
      destinationPhone: body.destinationPhone ?? null,
    };

    const deliveryValidation = validateDeliverySettings(delivery);
    if (!deliveryValidation.valid) {
      return secureJson({ success: false, error: deliveryValidation.error }, { status: 400 });
    }

    const normalizedTimezone = normalizeAgentTimezone(body.timezone ?? agent.timezone);

    const updated = await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: {
        safetySettings: mergeDeliverySettings(agent.safetySettings, delivery),
        ...(body.schedule ? { schedule: body.schedule } : {}),
        timezone: normalizedTimezone,
      },
    });

    let scheduleRecord = null;
    if (body.schedule) {
      scheduleRecord = await syncAgentSchedule(supabase, {
        agentId: agent.id,
        userId: user.id,
        organizationId: agent.organizationId,
        schedule: body.schedule,
        scheduleSummary: body.scheduleSummary,
        timezone: normalizedTimezone,
        agentActive: !isAgentDbStatusPaused(updated.status),
      });
    }

    const parsedDelivery = parseDeliverySettings(updated.safetySettings);
    const resendStatus = getResendConfigStatus();
    const destinationForEmail =
      parsedDelivery.destinationEmail ?? user.email ?? "";
    const deliveryWarning =
      parsedDelivery.mode === "email" || parsedDelivery.mode === "both"
        ? resendSandboxRecipientWarning(destinationForEmail)
        : null;

    return secureJson({
      success: true,
      deliveryWarning,
      agent: {
        id: updated.id,
        slug: updated.slug,
        delivery: parsedDelivery,
        emailDeliveryConnected: isEmailDeliveryConnected(),
        whatsappDeliveryConnected: isWhatsAppDeliveryConnected(),
        emailDeliverySandbox: resendStatus.sandboxMode,
        emailDeliverySandboxRecipient:
          resendStatus.sandboxRecipient ?? user.email ?? null,
        timezone: updated.timezone,
        schedule: updated.schedule,
        nextRunAt:
          scheduleRecord?.nextRunAt ??
          scheduleRecord?.previewNextRunAt ??
          null,
        nextRunAtLabel: formatNextRunAt(
          scheduleRecord?.nextRunAt ??
            scheduleRecord?.previewNextRunAt ??
            null,
          normalizedTimezone
        ),
        schedulePaused: !isAgentDbStatusPaused(updated.status) ? false : true,
      },
    });
  } catch (err) {
    if (err instanceof ScheduleValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }

    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Failed to update agent settings.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
