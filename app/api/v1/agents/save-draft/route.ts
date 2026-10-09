import { AgentKeyError } from "@/lib/gateway/errors";
import { saveBuilderAgentDraft } from "@/lib/agents/save-builder-agent-draft";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { saveBuilderAgentDraftSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, saveBuilderAgentDraftSchema);

    const result = await saveBuilderAgentDraft(supabase, {
      userId: user.id,
      userEmail: user.email ?? "user@local",
      input: {
        agentDbId: body.agentDbId,
        displayName: body.displayName,
        goal: body.goal,
        instructions: body.instructions,
        scheduleSummary: body.scheduleSummary,
        schedule: body.schedule,
        timezone: body.timezone,
        capabilityIds: body.capabilityIds,
        tools: body.tools,
        triggerType: body.triggerType,
        suggestedThreshold: body.suggestedThreshold,
        status: body.status,
      },
    });

    return secureJson(
      {
        success: true,
        agentDbId: result.agentDbId,
        slug: result.slug,
        apiKey: result.apiKey,
        keyPrefix: result.keyPrefix,
      },
      { status: body.agentDbId ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    if (err instanceof AgentKeyError) {
      const status = err.message.includes("admin") ? 403 : 500;
      return secureJson({ success: false, error: err.message }, { status });
    }

    console.error("Builder agent save failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not save your agent. Try again.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
