import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decideGatewayProposalReview } from "@/lib/gateway/proposals/human-decision";
import { getActionProposalById } from "@/lib/gateway/proposals/repository";
import {
  consumeEmailApprovalTokenAtomically,
  findEmailApprovalTokenByHash,
} from "./repository";
import { emailApprovalTokenHashFromPlain } from "./create-token";
import type { EmailApprovalAction } from "./urls";
import { verifyEmailApprovalToken, isPlausibleEmailApprovalToken } from "./crypto";

export type EmailApprovalResultKind =
  | "approved"
  | "denied"
  | "already_used"
  | "expired"
  | "invalid"
  | "not_found"
  | "proposal_unavailable";

export interface EmailApprovalResult {
  kind: EmailApprovalResultKind;
  title: string;
  message: string;
  proposalId?: string;
  toolName?: string;
  agentId?: string;
}

function mapDecision(action: EmailApprovalAction): "approved" | "rejected" {
  return action === "approve" ? "approved" : "rejected";
}

export async function processEmailApprovalAction(
  plainToken: string,
  action: EmailApprovalAction
): Promise<EmailApprovalResult> {
  const decoded = decodeURIComponent(plainToken).trim();

  console.info("[email-approval] approval requested", {
    action,
    tokenPrefix: decoded.slice(0, 24),
  });

  if (!isPlausibleEmailApprovalToken(decoded)) {
    console.warn("[email-approval] invalid token format", { action });
    return {
      kind: "invalid",
      title: "Invalid link",
      message: "This approval link is not valid. Open Wave and review pending actions from your dashboard.",
    };
  }

  const tokenHash = emailApprovalTokenHashFromPlain(decoded);
  if (!tokenHash) {
    return {
      kind: "invalid",
      title: "Invalid link",
      message: "This approval link is not valid. Open Wave and review pending actions from your dashboard.",
    };
  }

  const admin = createAdminClient();
  const stored = await findEmailApprovalTokenByHash(admin, tokenHash);

  if (!stored) {
    console.warn("[email-approval] token not found", {
      action,
      tokenPrefix: decoded.slice(0, 24),
    });
    return {
      kind: "not_found",
      title: "Link not recognized",
      message: "This approval link could not be found. It may have expired or already been used.",
    };
  }

  if (!verifyEmailApprovalToken(decoded, stored.token_hash)) {
    console.warn("[email-approval] token hash mismatch", {
      action,
      tokenPrefix: stored.token_prefix,
    });
    return {
      kind: "invalid",
      title: "Invalid link",
      message: "This approval link is not valid.",
    };
  }

  console.info("[email-approval] approval token verified", {
    action,
    proposalId: stored.action_proposal_id,
    tokenPrefix: stored.token_prefix,
    reviewerEmail: stored.reviewer_email,
  });

  if (stored.used_at) {
    const prior = stored.used_action === "approve" ? "approved" : "denied";
    console.info("[email-approval] token already used", {
      proposalId: stored.action_proposal_id,
      priorAction: stored.used_action,
    });
    return {
      kind: "already_used",
      title: prior === "approved" ? "Already approved" : "Already denied",
      message: `This action was already ${prior}. You can close this page.`,
      proposalId: stored.action_proposal_id,
    };
  }

  const now = new Date();
  if (new Date(stored.expires_at) <= now) {
    console.warn("[email-approval] expired token", {
      proposalId: stored.action_proposal_id,
      expiresAt: stored.expires_at,
    });
    return {
      kind: "expired",
      title: "Link expired",
      message: "This approval link has expired. Sign in to Wave to review pending actions.",
      proposalId: stored.action_proposal_id,
    };
  }

  const proposal = await getActionProposalById(admin, {
    proposalId: stored.action_proposal_id,
    organizationId: stored.organization_id,
  });

  if (!proposal) {
    return {
      kind: "not_found",
      title: "Action not found",
      message: "This approval could not be found.",
      proposalId: stored.action_proposal_id,
    };
  }

  const decision = mapDecision(action);
  const readClient = await createClient();

  try {
    await decideGatewayProposalReview(readClient, admin, {
      proposalId: stored.action_proposal_id,
      organizationId: stored.organization_id,
      actorId: stored.reviewer_id,
      actorEmail: stored.reviewer_email,
      decision,
      note: "Decision via email link",
    });
  } catch (err) {
    console.error("[email-approval] decision failed", {
      proposalId: stored.action_proposal_id,
      action,
      error: err instanceof Error ? err.message : String(err),
    });

    const message = err instanceof Error ? err.message : "Could not process this decision.";
    if (message.includes("expired") || message.includes("already")) {
      await consumeEmailApprovalTokenAtomically(admin, {
        tokenHash: stored.token_hash,
        action,
        usedAt: now.toISOString(),
      });
      return {
        kind: "proposal_unavailable",
        title: "Action no longer pending",
        message,
        proposalId: stored.action_proposal_id,
        toolName: proposal.tool_name,
        agentId: proposal.agent_id,
      };
    }

    return {
      kind: "invalid",
      title: "Could not complete action",
      message: `${message} You can sign in to Wave to review this action manually.`,
      proposalId: stored.action_proposal_id,
    };
  }

  const consumed = await consumeEmailApprovalTokenAtomically(admin, {
    tokenHash: stored.token_hash,
    action,
    usedAt: now.toISOString(),
  });

  if (!consumed) {
    console.info("[email-approval] token already consumed after decision", {
      proposalId: stored.action_proposal_id,
    });
  }

  if (decision === "approved") {
    console.info("[email-approval] approval accepted", {
      proposalId: stored.action_proposal_id,
      reviewerEmail: stored.reviewer_email,
    });
    return {
      kind: "approved",
      title: "Approval successful",
      message: "The action has been approved. You can close this page.",
      proposalId: stored.action_proposal_id,
      toolName: proposal.tool_name,
      agentId: proposal.agent_id,
    };
  }

  console.info("[email-approval] approval rejected", {
    proposalId: stored.action_proposal_id,
    reviewerEmail: stored.reviewer_email,
  });
  return {
    kind: "denied",
    title: "Action denied",
    message: "The action has been denied. You can close this page.",
    proposalId: stored.action_proposal_id,
    toolName: proposal.tool_name,
    agentId: proposal.agent_id,
  };
}
