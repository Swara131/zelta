import { publishBuilderAgent } from "@/lib/agents/save-builder-agent-draft";
import { TemplateActivationError } from "@/lib/templates/activation";
import {
  parseJsonBody,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { publishBuilderAgentSchema } from "@/lib/security/validation";
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
    const body = await parseJsonBody(request, publishBuilderAgentSchema);

    const result = await publishBuilderAgent(supabase, {
      userId: user.id,
      agentDbId: body.agentDbId,
    });

    return secureJson({
      success: true,
      slug: result.slug,
      publishedAt: result.publishedAt,
    });
  } catch (err) {
    if (err instanceof TemplateActivationError) {
      return secureJson({ success: false, error: err.message }, { status: 403 });
    }

    if (err instanceof ValidationError) {
      const message = err.details[0] ?? err.message;
      return secureJson({ success: false, error: message }, { status: 400 });
    }

    console.error("Builder agent publish failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not publish your agent. Try again.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
