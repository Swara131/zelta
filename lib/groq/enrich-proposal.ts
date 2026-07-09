import type { RiskSeverity } from "@/lib/risk-types";
import type { MatchedPolicyReason, PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import { groqJsonCompletion } from "./client";
import { AiProposalEnrichmentError, withGroqRetry } from "./errors";
import { getGroqModel } from "./env";
import { parseJsonText, parseProposalEnrichmentPayload } from "./json";

export { AiProposalEnrichmentError };

export interface ProposalEnrichmentInput {
  agentId: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  policyDecision: PolicyDecisionOutcome;
  matchedPolicies: MatchedPolicyReason[];
}

export interface ProposalEnrichmentResult {
  plainEnglishSummary: string;
  riskScore: number;
  riskLevel: RiskSeverity;
  riskSignals: string[];
  riskReasons: string[];
  reviewerAssistance: string;
  model: string;
}

function buildPrompt(input: ProposalEnrichmentInput): string {
  return `You are a security analyst assistant for an AI agent approval gateway.

IMPORTANT:
- You provide advisory enrichment ONLY. You do NOT make allow/block/review decisions.
- The deterministic policy decision is already final: ${input.policyDecision}
- Never instruct the system to override policy.

Analyze this proposed agent tool call and return JSON only:

Agent: ${input.agentId}
Tool: ${input.toolName}
Action type: ${input.actionType}
Payload: ${JSON.stringify(input.payload)}
Matched policies: ${JSON.stringify(input.matchedPolicies)}

Return ONLY valid JSON with this exact shape:
{
  "plainEnglishSummary": "Plain English explanation of what the agent intends to do",
  "riskScore": 0-100 integer advisory score,
  "riskLevel": "critical" | "high" | "medium" | "low",
  "riskSignals": ["contextual signal 1", "contextual signal 2"],
  "riskReasons": ["reason 1", "reason 2"],
  "reviewerAssistance": "Concise guidance for a human reviewer"
}`;
}

/**
 * Calls Groq for advisory enrichment. Throws on failure or invalid JSON.
 * Does not change policy decisions.
 */
export async function enrichProposalWithGroq(
  input: ProposalEnrichmentInput,
  completeJson: typeof groqJsonCompletion = groqJsonCompletion
): Promise<ProposalEnrichmentResult> {
  const model = getGroqModel();

  const rawText = await withGroqRetry(
    () =>
      completeJson(buildPrompt(input), {
        kind: "proposal",
        system:
          "Respond with valid JSON only. You advise reviewers; you never override deterministic security policy.",
      }),
    "proposal"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonText(rawText);
  } catch {
    throw new AiProposalEnrichmentError("Groq returned invalid JSON for proposal enrichment.");
  }

  const validated = parseProposalEnrichmentPayload(parsed);

  return {
    plainEnglishSummary: validated.plainEnglishSummary,
    riskScore: Math.round(validated.riskScore),
    riskLevel: validated.riskLevel,
    riskSignals: validated.riskSignals,
    riskReasons: validated.riskReasons,
    reviewerAssistance: validated.reviewerAssistance,
    model,
  };
}
