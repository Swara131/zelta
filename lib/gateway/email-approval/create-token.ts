import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailAppBaseUrl } from "@/lib/email/env";
import {
  generateEmailApprovalToken,
  hashEmailApprovalToken,
} from "./crypto";
import { insertEmailApprovalToken } from "./repository";
import {
  buildEmailApprovalActionUrl,
  buildEmailApprovalReviewUrl,
} from "./urls";

export interface EmailApprovalLinks {
  approveUrl: string;
  denyUrl: string;
  reviewUrl: string;
  tokenPrefix: string;
}

export async function createEmailApprovalLinks(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    proposalId: string;
    reviewerId: string;
    reviewerEmail: string;
    expiresAt: string;
  }
): Promise<EmailApprovalLinks> {
  const baseUrl = getEmailAppBaseUrl();
  const { plainToken, tokenPrefix, tokenHash } = generateEmailApprovalToken();

  await insertEmailApprovalToken(supabase, {
    organizationId: params.organizationId,
    actionProposalId: params.proposalId,
    reviewerId: params.reviewerId,
    reviewerEmail: params.reviewerEmail,
    tokenHash,
    tokenPrefix,
    expiresAt: params.expiresAt,
  });

  const approveUrl = buildEmailApprovalActionUrl(baseUrl, "approve", plainToken);
  const denyUrl = buildEmailApprovalActionUrl(baseUrl, "deny", plainToken);
  const reviewUrl = buildEmailApprovalReviewUrl(baseUrl, params.proposalId);

  console.info("[email-approval] approval link generated", {
    proposalId: params.proposalId,
    reviewerEmail: params.reviewerEmail,
    tokenPrefix,
    baseUrl,
    approvePath: `/approve/${tokenPrefix}_…`,
    denyPath: `/deny/${tokenPrefix}_…`,
    expiresAt: params.expiresAt,
  });

  return { approveUrl, denyUrl, reviewUrl, tokenPrefix };
}

/** Validates token format before DB lookup (avoids unnecessary queries). */
export function emailApprovalTokenHashFromPlain(plainToken: string): string | null {
  const decoded = decodeURIComponent(plainToken).trim();
  if (!decoded || decoded.length < 40) {
    return null;
  }
  return hashEmailApprovalToken(decoded);
}
