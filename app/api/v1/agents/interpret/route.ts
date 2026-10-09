import {
  AGENT_BUILD_PARSE_ERROR,
  GROK_SERVICE_UNAVAILABLE,
  GrokAgentBuilderError,
  GrokServiceError,
} from "@/lib/xai/errors";
import { interpretAgentRequest } from "@/lib/agents/interpret-agent-request";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { interpretAgentSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, interpretAgentSchema);
    const interpretation = await interpretAgentRequest(body.description);

    return secureJson({
      success: true,
      interpretation,
    });
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
          ? "We couldn't understand that description. Try rephrasing in plain language."
          : err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    console.error("Agent interpretation failed:", err);
    return secureJson(
      { success: false, error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
