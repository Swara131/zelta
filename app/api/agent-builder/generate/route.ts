import { generateAgentSpecFromDescription } from "@/lib/groq/generate-agent-spec";
import { AiAgentBuilderError } from "@/lib/groq/errors";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { agentBuilderGenerateSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, agentBuilderGenerateSchema);
    const spec = await generateAgentSpecFromDescription(body.description);
    return secureJson({ spec });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    if (err instanceof AiAgentBuilderError) {
      return secureError(err.message, 400);
    }
    const message =
      err instanceof Error ? err.message : "Failed to generate agent.";
    return secureError(message, 500);
  }
}
