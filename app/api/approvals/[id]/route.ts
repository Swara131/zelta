import { NextResponse } from "next/server";
import { decideApproval } from "@/lib/approvals/engine";
import { ApprovalEngineError } from "@/lib/approvals/errors";
import { getApprovalRequest } from "@/lib/approvals/repository";
import { getApprovalDashboardStats } from "@/lib/approvals/stats";
import { recordAudit } from "@/lib/audit/logger";
import type { AuditAction } from "@/lib/audit/types";
import { ProposalError } from "@/lib/gateway/errors";
import { decideGatewayProposalReview } from "@/lib/gateway/proposals/human-decision";
import { getActionProposalById } from "@/lib/gateway/proposals/repository";
import { ensureOrganization } from "@/lib/organizations/ensure-organization";
import {
  assertUuid,
  parseJsonBody,
  sanitizeUserText,
  secureError,
  secureJson,
} from "@/lib/security/api";
import { ValidationError } from "@/lib/security/errors";
import { approvalDecisionSchema } from "@/lib/security/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    assertUuid(id, "approval request id");
    const body = await parseJsonBody(request, approvalDecisionSchema);
    const decision = body.decision;
    const note = body.note ? sanitizeUserText(body.note) : undefined;

    const organizationId = await ensureOrganization(
      supabase,
      user.id,
      user.email ?? "user@local"
    );

    const gatewayProposal = await getActionProposalById(supabase, {
      proposalId: id,
      organizationId,
    });

    if (gatewayProposal) {
      if (gatewayProposal.status !== "review_required") {
        throw new ProposalError(`Proposal is already ${gatewayProposal.status}.`);
      }

      if (decision !== "approved" && decision !== "rejected") {
        return secureError(
          "Gateway proposals only support approve or reject decisions.",
          400
        );
      }

      const admin = createAdminClient();
      const result = await decideGatewayProposalReview(supabase, admin, {
        proposalId: id,
        organizationId,
        actorId: user.id,
        actorEmail: user.email ?? "unknown@local",
        decision,
        note,
        request,
      });

      return secureJson({ result });
    }

    const approval = await getApprovalRequest(supabase, id);

    const result = await decideApproval(supabase, {
      requestId: id,
      actorId: user.id,
      decision,
      note,
    });

    const auditAction: AuditAction =
      decision === "approved"
        ? "approve"
        : decision === "rejected"
          ? "reject"
          : decision === "escalated"
            ? "escalate"
            : "update";

    await recordAudit(supabase, {
      request,
      userId: user.id,
      organizationId: approval?.organization_id,
      action: auditAction,
      entityType: "approval_request",
      entityId: id,
      riskSeverity: approval?.risk_severity ?? null,
      approvalStatus: result.status,
      metadata: {
        title: approval?.title,
        description:
          decision === "approved"
            ? `Approved "${approval?.title ?? id}" (${result.approvalsReceived}/${result.requiredApprovals})`
            : `${decision.replace("_", " ")} — ${approval?.title ?? id}`,
        note,
        finalized: result.finalized,
      },
    });

    const stats = await getApprovalDashboardStats(supabase);

    return secureJson({ result, stats });
  } catch (err) {
    if (err instanceof ValidationError) {
      return secureError(err.message, 400, { details: err.details });
    }
    if (err instanceof ProposalError) {
      const status = err.message.includes("not found") ? 404 : 400;
      return secureError(err.message, status);
    }
    const message =
      err instanceof ApprovalEngineError ? err.message : "Failed to process decision.";
    const status = message.includes("not found") ? 404 : 500;
    return secureError(message, status);
  }
}
