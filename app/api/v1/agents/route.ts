import { AgentKeyError } from "@/lib/gateway/errors";
import { createBuilderAgent } from "@/lib/agents/create-builder-agent";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createBuilderAgentSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, createBuilderAgentSchema);

    console.log("Creating agent for user:", user.id);
    console.log("Agent data:", body);

    const result = await createBuilderAgent(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      input: {
        name: body.name,
        description: body.description,
        source: body.source,
        tools: body.tools,
        triggerType: body.triggerType,
        suggestedThreshold: body.suggestedThreshold,
      },
    });

    return secureJson(
      {
        success: true,
        agentId: result.agent.slug,
        id: result.agent.id,
        name: result.agent.name,
        status: result.agent.status,
        message: "Agent created successfully",
        spec: result.spec,
        key: result.apiKey.key,
        plainKey: result.apiKey.plainKey,
        policy: {
          threshold: result.policy.threshold,
          autoAllow: result.policy.autoAllow,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof AgentKeyError) {
      console.error("Agent API key creation failed:", err);
      const status = err.message.includes("admin") ? 403 : 500;
      return secureJson(
        { success: false, error: err.message },
        { status }
      );
    }

    console.error("Agent creation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create agent.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
