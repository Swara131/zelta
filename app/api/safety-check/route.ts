import { z } from "zod";
import { parseJsonBody, secureError, secureJson } from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { evaluateSafetyCheck } from "@/lib/safety-check/evaluate-safety-check";
import { DEMO_ACTION_IDS } from "@/lib/safety-check/demo-action-catalog";

const safetyCheckSchema = z.object({
  agentId: z.string().trim().min(1).max(128),
  agentName: z.string().trim().min(1).max(128),
  actionId: z.enum(DEMO_ACTION_IDS),
  customerId: z.string().trim().max(128).optional().default(""),
  reason: z.string().trim().max(2000).optional().default(""),
  amountInr: z.number().finite().nonnegative().nullable().optional(),
});

/** Demo safety check — policy + risk only; nothing is persisted or executed. */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, safetyCheckSchema);
    const result = evaluateSafetyCheck({
      agentId: body.agentId,
      agentName: body.agentName,
      actionId: body.actionId,
      customerId: body.customerId,
      reason: body.reason,
      amountInr: body.amountInr,
    });

    return secureJson({ result });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }

    const message =
      err instanceof Error ? err.message : "Safety check failed.";
    return secureError(message, 500);
  }
}
