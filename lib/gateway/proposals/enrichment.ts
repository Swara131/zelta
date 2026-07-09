import type { MatchedPolicyReason, PolicyDecisionOutcome } from "@/lib/gateway/policy/types";
import {
  enrichProposalWithGroq,
  type ProposalEnrichmentInput,
  type ProposalEnrichmentResult,
} from "@/lib/groq/enrich-proposal";

export interface StoredRiskReasons {
  matchedPolicies: MatchedPolicyReason[];
  ai?: {
    riskSignals?: string[];
    riskReasons?: string[];
    reviewerAssistance?: string;
    model?: string;
    failure?: {
      message: string;
      recordedAt: string;
    };
  };
}

export type EnrichmentOutcome =
  | { ok: true; data: ProposalEnrichmentResult }
  | { ok: false; error: string };

export function buildStoredRiskReasons(
  matchedPolicies: MatchedPolicyReason[],
  enrichment: EnrichmentOutcome
): StoredRiskReasons {
  if (enrichment.ok) {
    return {
      matchedPolicies,
      ai: {
        riskSignals: enrichment.data.riskSignals,
        riskReasons: enrichment.data.riskReasons,
        reviewerAssistance: enrichment.data.reviewerAssistance,
        model: enrichment.data.model,
      },
    };
  }

  return {
    matchedPolicies,
    ai: {
      failure: {
        message: enrichment.error,
        recordedAt: new Date().toISOString(),
      },
    },
  };
}

export function extractMatchedPoliciesFromRiskReasons(
  value: unknown
): MatchedPolicyReason[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is MatchedPolicyReason =>
        typeof item === "object" &&
        item !== null &&
        "policyId" in item &&
        "decision" in item
    );
  }

  if (typeof value === "object" && value !== null && "matchedPolicies" in value) {
    const matched = (value as StoredRiskReasons).matchedPolicies;
    return Array.isArray(matched) ? matched : [];
  }

  return [];
}

/**
 * Advisory-only Groq enrichment. Never mutates the deterministic policy decision.
 */
export async function safeEnrichProposalAction(
  input: ProposalEnrichmentInput,
  enrichFn: typeof enrichProposalWithGroq = enrichProposalWithGroq
): Promise<EnrichmentOutcome> {
  try {
    const data = await enrichFn(input);
    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Proposal enrichment failed.";
    return { ok: false, error: message };
  }
}

/** Policy decision is authoritative — AI cannot downgrade BLOCK or upgrade to ALLOW alone. */
export function assertPolicyDecisionUnchanged(params: {
  policyDecision: PolicyDecisionOutcome;
  finalDecision: PolicyDecisionOutcome;
}): void {
  if (params.policyDecision !== params.finalDecision) {
    throw new Error("Policy decision was modified by enrichment pipeline.");
  }
}

export function resolveFinalDecision(
  policyDecision: PolicyDecisionOutcome,
  _enrichment: EnrichmentOutcome
): PolicyDecisionOutcome {
  assertPolicyDecisionUnchanged({
    policyDecision,
    finalDecision: policyDecision,
  });
  return policyDecision;
}

export {
  enrichProposalWithGroq,
  type ProposalEnrichmentInput,
  type ProposalEnrichmentResult,
};
