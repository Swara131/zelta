import { buildAgentBuildViewFromParse } from "@/lib/agent-builder/build-response";
import {
  AGENT_BUILD_PARSE_ERROR,
  GROK_SERVICE_UNAVAILABLE,
  GrokAgentBuilderError,
  GrokServiceError,
} from "@/lib/xai/errors";
import { generateAgentBuildFromSentence } from "@/lib/xai/parse-agent-build";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { agentBuildSentenceSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, agentBuildSentenceSchema);

    console.log("Agent build request:", body.sentence);
    console.log("Agent build user:", user.id);

    const parsed = await generateAgentBuildFromSentence(body.sentence);
    const view = buildAgentBuildViewFromParse(parsed, body.sentence);

    return secureJson({
      success: true,
      name: parsed.name,
      description: parsed.description,
      tools: parsed.tools,
      triggerType: parsed.triggerType,
      suggestedThreshold: parsed.suggestedThreshold,
      spec: view.spec,
      trigger: view.trigger,
      suggestedThresholdInr: view.suggestedThresholdInr,
      sentence: view.sentence,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }

    if (err instanceof GrokServiceError) {
      console.error("Grok service error:", err.message);
      return secureJson(
        { success: false, error: GROK_SERVICE_UNAVAILABLE },
        { status: 503 }
      );
    }

    if (err instanceof GrokAgentBuilderError) {
      console.error("Agent build parse error:", err.message);
      const message = err.message;
      if (message === AGENT_BUILD_PARSE_ERROR) {
        return secureJson(
          { success: false, error: AGENT_BUILD_PARSE_ERROR },
          { status: 400 }
        );
      }
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    console.error("Agent build unexpected error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to parse agent description.";
    return secureError(message, 500);
  }
}
