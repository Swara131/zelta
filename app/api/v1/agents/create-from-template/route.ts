import { AgentKeyError } from "@/lib/gateway/errors";
import { createAgentFromTemplate } from "@/lib/templates/create-from-template";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { RateLimitError, ValidationError } from "@/lib/security/errors";
import {
  enforceRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMIT_STRICT_MAX,
} from "@/lib/security/rate-limit";
import { createFromTemplateSchema } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return secureError("Unauthorized", 401);
  }

  try {
    enforceRateLimit(
      rateLimitKey(`${getClientIp(request)}:${user.id}`, "create-from-template"),
      RATE_LIMIT_STRICT_MAX
    );

    const body = await parseJsonBody(request, createFromTemplateSchema);

    const result = await createAgentFromTemplate(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      templateId: body.templateId,
      customizations: {
        threshold: body.customizations.threshold,
        needsApproval: body.customizations.needsApproval,
        customInstructions: body.customizations.customInstructions,
      },
    });

    return secureJson(
      {
        success: true,
        agentId: result.agentId,
        apiKey: result.apiKey,
        keyPrefix: result.keyPrefix,
        name: result.name,
        description: result.description,
        tools: result.tools,
        triggerType: result.triggerType,
        suggestedThreshold: result.suggestedThreshold,
        templateId: result.templateId,
        templateName: result.templateName,
        riskLevel: result.riskLevel ?? null,
        spec: result.spec,
        ready: true,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return secureJson({ success: false, error: err.message }, { status: 429 });
    }

    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof AgentKeyError) {
      const status = err.message.includes("admin") ? 403 : 500;
      return secureJson({ success: false, error: err.message }, { status });
    }

    if (err instanceof Error && err.message === "Template not found.") {
      return secureJson({ success: false, error: err.message }, { status: 404 });
    }

    console.error("Create from template failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create agent from template.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
