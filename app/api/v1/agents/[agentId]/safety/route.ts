import type { NextRequest } from "next/server";
import {
  AgentNotFoundError,
  enforceSafetyMutationRateLimit,
  requireAgentForSafetyApi,
} from "@/lib/safety/autopilot/api-auth";
import {
  AutomaticPermissionConfirmRequiredError,
  ensureDefaultAutopilot,
  loadSafetyAutopilot,
  ProtectionModeConfirmRequiredError,
  updateApprovalRules,
  updateDataProtection,
  updateExecutionLimits,
  updateProtectionMode,
  updateToolPermission,
} from "@/lib/safety/autopilot/service";
import {
  activityFilterSchema,
  updateApprovalRulesSchema,
  updateDataProtectionSchema,
  updateExecutionLimitsSchema,
  updateProtectionModeSchema,
  updateToolPermissionSchema,
} from "@/lib/safety/autopilot/validation";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

const patchSafetySchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("protection_mode"), ...updateProtectionModeSchema.shape }),
  z.object({ section: z.literal("tool_permission"), ...updateToolPermissionSchema.shape }),
  z.object({ section: z.literal("approval_rules"), ...updateApprovalRulesSchema.shape }),
  z.object({ section: z.literal("data_protection"), ...updateDataProtectionSchema.shape }),
  z.object({ section: z.literal("execution_limits"), ...updateExecutionLimitsSchema.shape }),
]);

export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  try {
    const agent = await requireAgentForSafetyApi(supabase, user, slug ?? "");
    await ensureDefaultAutopilot(supabase, agent);

    const url = new URL(request.url);
    const filters = activityFilterSchema.safeParse({
      severity: url.searchParams.get("severity") ?? undefined,
      tool: url.searchParams.get("tool") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const snapshot = await loadSafetyAutopilot(
      supabase,
      agent,
      filters.success ? filters.data : undefined
    );

    return secureJson({ success: true, ...snapshot });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Failed to load safety settings.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  const { agentId: slug } = await context.params;
  try {
    enforceSafetyMutationRateLimit(request, "safety-patch", user.id);
    const body = await parseJsonBody(request, patchSafetySchema);
    const agent = await requireAgentForSafetyApi(supabase, user, slug ?? "");

    let snapshot;
    switch (body.section) {
      case "protection_mode":
        snapshot = await updateProtectionMode(
          supabase,
          agent,
          body.mode,
          body.confirmRiskIncrease
        );
        break;
      case "tool_permission":
        snapshot = await updateToolPermission(
          supabase,
          agent,
          body.toolId,
          body.permissionLevel,
          body.confirmAutomatic
        );
        break;
      case "approval_rules":
        snapshot = await updateApprovalRules(supabase, agent, body.rules);
        break;
      case "data_protection": {
        const { section, ...dataProtection } = body;
        if (section !== "data_protection") break;
        snapshot = await updateDataProtection(supabase, agent, dataProtection);
        break;
      }
      case "execution_limits": {
        const { section, ...limits } = body;
        if (section !== "execution_limits") break;
        snapshot = await updateExecutionLimits(supabase, agent, limits);
        break;
      }
    }

    return secureJson({ success: true, ...snapshot });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof ProtectionModeConfirmRequiredError) {
      return secureJson(
        {
          success: false,
          error: err.message,
          requiresConfirmation: true,
          from: err.from,
          to: err.to,
        },
        { status: 409 }
      );
    }
    if (err instanceof AutomaticPermissionConfirmRequiredError) {
      return secureJson(
        {
          success: false,
          error: err.message,
          requiresConfirmation: true,
          toolId: err.toolId,
        },
        { status: 409 }
      );
    }
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.details[0] ?? err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to update safety settings.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
