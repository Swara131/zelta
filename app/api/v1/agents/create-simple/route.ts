import { AgentKeyError } from "@/lib/gateway/errors";
import { createSimpleAgent } from "@/lib/agents/create-simple-agent";
import {
  AGENT_BUILD_PARSE_ERROR,
  GROK_SERVICE_UNAVAILABLE,
  GrokAgentBuilderError,
  GrokServiceError,
} from "@/lib/xai/errors";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createSimpleAgentSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, createSimpleAgentSchema);

    const result = await createSimpleAgent(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      description: body.description,
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
        spec: result.spec,
        ready: true,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof GrokServiceError) {
      return secureJson(
        { success: false, error: GROK_SERVICE_UNAVAILABLE },
        { status: 503 }
      );
    }

    if (err instanceof GrokAgentBuilderError) {
      const message =
        err.message === AGENT_BUILD_PARSE_ERROR
          ? "We couldn't understand that description. Try rephrasing in one clear sentence."
          : err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof AgentKeyError) {
      const status = err.message.includes("admin") ? 403 : 500;
      return secureJson({ success: false, error: err.message }, { status });
    }

    console.error("Simple agent creation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create agent.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
