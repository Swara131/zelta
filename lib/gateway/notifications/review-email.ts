import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgReviewerEmails, displayName } from "@/lib/email/repository";
import { notifyGatewayReviewRequiredEmail } from "@/lib/email/service";
import type { RiskSeverity } from "@/lib/risk-types";

export interface GatewayReviewNotificationParams {
  organizationId: string;
  proposalId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  plainEnglishSummary: string;
  riskLevel: RiskSeverity;
  riskScore: number;
}

/**
 * Sends Resend email to org reviewers when policy routes a proposal to REVIEW.
 * Never includes API keys, execution tokens, or secrets.
 */
export async function notifyGatewayReviewRequired(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams
): Promise<void> {
  try {
    const reviewers = await getOrgReviewerEmails(supabase, params.organizationId);
    if (reviewers.length === 0) {
      return;
    }

    await Promise.all(
      reviewers.map((reviewer) =>
        notifyGatewayReviewRequiredEmail(supabase, {
          organizationId: params.organizationId,
          userId: reviewer.id,
          recipientEmail: reviewer.email,
          recipientName: displayName(reviewer),
          proposalId: params.proposalId,
          agentId: params.agentId,
          toolName: params.toolName,
          actionType: params.actionType,
          plainEnglishSummary: params.plainEnglishSummary,
          riskLevel: params.riskLevel,
          riskScore: params.riskScore,
        })
      )
    );
  } catch (err) {
    console.error("[gateway] Review notification email failed:", err);
  }
}
