import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { syncAgentSchedule } from "@/lib/agents/scheduling/sync-agent-schedule";
import { mergeDeliverySettings, parseDeliverySettings } from "@/lib/agents/delivery/settings";
import { getAgentRequirements } from "@/lib/agents/requirements/engine";
import { snapshotFromBuilderAgent } from "@/lib/agents/requirements/from-agent";
import type { RequirementChoices, RequirementStage } from "@/lib/agents/requirements/types";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const patchSchema = z.object({
  stage: z.enum(["setup", "test", "deploy"]).optional(),
  key: z.string().trim().min(1).max(80).optional(),
  value: z.string().trim().max(4000).nullable().optional(),
  answers: z.record(z.string(), z.string()).optional(),
  destinationEmail: z.string().email().nullable().optional(),
  destinationPhone: z.string().trim().max(32).nullable().optional(),
  deliveryMode: z.enum(["email", "whatsapp", "notification", "both", "none"]).optional(),
  timezone: z.string().trim().max(80).optional(),
  scheduleWhen: z.enum(["manual", "daily", "weekly", "at_time", "on_event"]).optional(),
  scheduleTime: z.string().trim().max(8).optional(),
  outputChoice: z.enum(["notification", "email", "whatsapp", "slack", "other"]).optional(),
  customerSource: z.enum(["crm", "csv", "database", "api", "other"]).optional(),
});

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId } = await context.params;
  const stage = new URL(request.url).searchParams.get("stage") as RequirementStage | null;
  const agent = await getBuilderAgentForUserBySlug(supabase, {
    userId: user.id,
    userEmail: user.email ?? "user@local",
    slug: agentId?.trim() ?? "",
  });
  if (!agent) return secureJson({ success: false, error: "Agent not found." }, { status: 404 });

  const result = getAgentRequirements(
    snapshotFromBuilderAgent(agent, { stage: stage === "test" || stage === "deploy" ? stage : "setup" })
  );
  return secureJson({ success: true, ...result });
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId } = await context.params;
  try {
    const body = await parseJsonBody(request, patchSchema);
    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: agentId?.trim() ?? "",
    });
    if (!agent) return secureJson({ success: false, error: "Agent not found." }, { status: 404 });

    const currentDelivery = parseDeliverySettings(agent.safetySettings);
    const existingChoices = (agent.safetySettings.requirementChoices ?? {}) as RequirementChoices;
    const existingAnswers = {
      ...existingChoices,
      ...(agent.safetySettings.setupAnswers ?? {}),
    };

    if (body.key && body.value != null) {
      if (body.key === "email" && body.value && !isEmail(body.value)) {
        return secureJson({ success: false, error: "Enter a valid email address." }, { status: 400 });
      }
      if (
        (body.key === "api_integration" ||
          body.key === "external_connection" ||
          body.key === "company_website" ||
          body.key === "company_linkedin" ||
          body.key === "contact_linkedin" ||
          body.key === "company_api_endpoint" ||
          body.key === "contact_api_endpoint") &&
        body.value &&
        !isUrl(body.value)
      ) {
        return secureJson({ success: false, error: "Enter a valid website or endpoint URL." }, { status: 400 });
      }
    }

    const mergedAnswers: Record<string, string> = {};
    for (const [key, value] of Object.entries(existingAnswers)) {
      if (typeof value === "string" && value.trim()) mergedAnswers[key] = value.trim();
    }
    if (body.answers) {
      for (const [key, value] of Object.entries(body.answers)) {
        if (value?.trim()) mergedAnswers[key] = value.trim();
      }
    }
    if (body.key && body.value != null) {
      mergedAnswers[body.key] = body.value;
    }

    let deliveryMode = body.deliveryMode ?? currentDelivery.mode;
    const outputPick = body.outputChoice ?? mergedAnswers.output_destination ?? mergedAnswers.output;
    if (outputPick === "email") deliveryMode = "email";
    if (outputPick === "whatsapp") deliveryMode = "whatsapp";
    if (outputPick === "notification" || outputPick === "slack") deliveryMode = "notification";

    let destinationEmail =
      body.destinationEmail !== undefined ? body.destinationEmail : currentDelivery.destinationEmail;
    let destinationPhone =
      body.destinationPhone !== undefined ? body.destinationPhone : currentDelivery.destinationPhone;
    if (body.key === "email" && body.value) destinationEmail = body.value;
    if (body.key === "whatsapp" && body.value) destinationPhone = body.value;

    const requirementChoices: RequirementChoices = {
      ...existingChoices,
      output:
        (outputPick as RequirementChoices["output"]) ??
        body.outputChoice ??
        existingChoices.output,
      customerSource:
        (mergedAnswers.customer_source as RequirementChoices["customerSource"]) ??
        body.customerSource ??
        existingChoices.customerSource,
    };

    let scheduleWhen = body.scheduleWhen;
    let scheduleTime = body.scheduleTime;
    let timezone = body.timezone;
    if (body.key === "schedule" && body.value) {
      try {
        const parsed = JSON.parse(body.value) as { when?: string; time?: string; timezone?: string };
        scheduleWhen = (parsed.when as typeof scheduleWhen) ?? scheduleWhen;
        scheduleTime = parsed.time ?? scheduleTime;
        timezone = parsed.timezone ?? timezone;
      } catch {
        const parts = body.value.split("|");
        if (parts[0]) scheduleWhen = parts[0] as typeof scheduleWhen;
        if (parts[1]) scheduleTime = parts[1];
        if (parts[2]) timezone = parts[2];
      }
    }

    const safetyMode = mergedAnswers.safety || mergedAnswers.crm_policy;
    const requireApprovalFor =
      safetyMode === "ask" || safetyMode === "block"
        ? ["issue_refund", "update_crm_record", "delete_record", "send_email"]
        : agent.safetySettings.requireApprovalFor;

    const scheduled =
      scheduleWhen === "daily" || scheduleWhen === "weekly" || scheduleWhen === "at_time";

    const externalConnection = agent.safetySettings.externalConnection
      ? {
          ...agent.safetySettings.externalConnection,
          endpointUrl:
            mergedAnswers.external_connection || agent.safetySettings.externalConnection.endpointUrl,
          authType:
            (mergedAnswers.external_auth as "none" | "bearer" | "api_key_header" | undefined) ??
            agent.safetySettings.externalConnection.authType,
          authConfigured:
            mergedAnswers.external_auth === "none" ||
            Boolean(agent.safetySettings.externalConnection.authConfigured) ||
            mergedAnswers.external_auth === "bearer" ||
            mergedAnswers.external_auth === "api_key_header",
        }
      : agent.safetySettings.externalConnection;

    const safetySettings = {
      ...mergeDeliverySettings(agent.safetySettings, {
        mode: deliveryMode,
        destinationEmail,
        destinationPhone,
      }),
      requirementChoices,
      setupAnswers: mergedAnswers,
      requireApprovalFor,
      autoAllowBelowThreshold: safetyMode !== "block",
      externalConnection,
    };

    const schedule = {
      ...(agent.schedule ?? { when: "manual" as const }),
      when: scheduleWhen ?? agent.schedule?.when ?? "manual",
      time: scheduleTime ?? agent.schedule?.time,
    };

    const preview = getAgentRequirements(
      snapshotFromBuilderAgent(
        {
          ...agent,
          safetySettings,
          schedule,
          timezone: timezone ?? agent.timezone,
          triggerType: scheduled ? "schedule" : agent.triggerType,
        },
        { stage: body.stage ?? "setup" }
      )
    );
    const safetyWithManifest: typeof agent.safetySettings = {
      ...safetySettings,
      requirementManifest: {
        generatedAt: new Date().toISOString(),
        keys: preview.requirements.filter((item) => item.required).map((item) => item.key),
      },
    };

    await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: {
        safetySettings: safetyWithManifest,
        timezone: timezone ?? agent.timezone,
        schedule,
        triggerType: scheduled ? "schedule" : agent.triggerType,
      },
    });

    if (scheduled) {
      try {
        await syncAgentSchedule(supabase, {
          agentId: agent.id,
          userId: user.id,
          organizationId: agent.organizationId,
          schedule,
          timezone: timezone ?? agent.timezone ?? "UTC",
          agentActive: agent.status === "active" || agent.status === "published",
        });
      } catch (err) {
        console.warn("[scheduler] schedule sync from prepare skipped:", err);
      }
    }

    const refreshed = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: agent.slug,
    });
    const result = getAgentRequirements(
      snapshotFromBuilderAgent(refreshed ?? agent, { stage: body.stage ?? "setup" })
    );
    return secureJson({ success: true, ...result });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not update requirements.";
    return secureJson({ success: false, error: message }, { status: 400 });
  }
}
