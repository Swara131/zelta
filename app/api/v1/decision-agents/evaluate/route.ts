import { evaluateDecision } from "@/lib/decision-agents/evaluate-decision";
import { parseDecisionAgentConfig } from "@/lib/decision-agents/parse-config";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const evaluateSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  input: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return secureError("Unauthorized", 401);

  try {
    const body = await parseJsonBody(request, evaluateSchema);
    const config = parseDecisionAgentConfig(body.config);
    if (!config) {
      throw new ValidationError("Decision agent config is incomplete.");
    }
    const result = evaluateDecision(config, body.input);
    return secureJson({
      success: true,
      decision: result.outcome.toUpperCase(),
      reason: result.reasoning,
      risk: result.riskLevel,
      result,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureJson({ success: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Evaluation failed.";
    return secureJson({ success: false, error: message }, { status: 500 });
  }
}
