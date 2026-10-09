import { isAgentDbStatusPaused } from "@/lib/agents/agent-mode";
import { updateBuilderAgent } from "@/lib/agents/repository";
import { syncAgentSchedule } from "@/lib/agents/scheduling/sync-agent-schedule";
import {
  getAgentScheduleByAgentId,
  upsertAgentSchedule,
} from "@/lib/agents/runtime-repository";
import { getBuilderAgentForUserBySlug } from "@/lib/agents/save-builder-agent-draft";
import {
  assertTemplateAgentCanActivate,
  TemplateActivationError,
} from "@/lib/templates/activation";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { updateAgentStatusSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

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
    const body = await parseJsonBody(request, updateAgentStatusSchema);

    const agent = await getBuilderAgentForUserBySlug(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      slug: normalizedSlug,
    });

    if (!agent) {
      return secureJson({ error: "Agent not found." }, { status: 404 });
    }

    const nextStatus = body.status === "paused" ? "paused" : "active";

    if (nextStatus === "active") {
      assertTemplateAgentCanActivate(agent);
    }

    const updated = await updateBuilderAgent(supabase, {
      agentId: agent.id,
      userId: user.id,
      patch: { status: nextStatus },
    });

    const schedule = await getAgentScheduleByAgentId(supabase, {
      agentId: agent.id,
      userId: user.id,
    });

    if (isAgentDbStatusPaused(nextStatus)) {
      if (schedule) {
        await upsertAgentSchedule(supabase, {
          agentId: agent.id,
          userId: user.id,
          organizationId: agent.organizationId,
          frequency: schedule.frequency,
          timezone: schedule.timezone,
          scheduleConfig: schedule.scheduleConfig as Record<string, unknown>,
          cronExpression: schedule.cronExpression,
          nextRunAt: null,
          enabled: false,
          status: "paused",
        });
        console.log("[scheduler] agent paused — schedule disabled", {
          agentId: agent.id,
        });
      }
    } else if (agent.schedule?.when && agent.schedule.when !== "manual") {
      await syncAgentSchedule(supabase, {
        agentId: agent.id,
        userId: user.id,
        organizationId: agent.organizationId,
        schedule: agent.schedule,
        timezone: agent.timezone,
        agentActive: true,
      });
      console.log("[scheduler] agent resumed — next run recomputed", {
        agentId: agent.id,
      });
    }

    return secureJson({
      success: true,
      agent: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
      },
    });
  } catch (err) {
    if (err instanceof TemplateActivationError) {
      return secureJson({ success: false, error: err.message }, { status: 403 });
    }

    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : "Failed to update agent status.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
