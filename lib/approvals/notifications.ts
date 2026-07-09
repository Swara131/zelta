import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notifyApprovalApproved,
  notifyApprovalRejected,
  notifyApprovalRequested,
} from "@/lib/email/service";
import { displayName, getUserById } from "@/lib/email/repository";

type ApprovalRow = {
  id: string;
  organization_id: string;
  requester_id: string;
  title: string;
  agent_id: string;
  risk_severity: import("@/lib/risk-types").RiskSeverity;
  required_approvals: number;
  sla_deadline: string;
  ai_explanation: string;
};

export async function sendApprovalCreatedEmails(
  supabase: SupabaseClient,
  row: ApprovalRow,
  autoApprove: boolean
): Promise<void> {
  try {
    if (autoApprove) {
      await notifyApprovalApproved(supabase, {
        organizationId: row.organization_id,
        requesterId: row.requester_id,
        approvalRequestId: row.id,
        title: row.title,
        severity: row.risk_severity,
        agentId: row.agent_id,
        actorName: "Approval Engine (auto-approved)",
      });
      return;
    }

    await notifyApprovalRequested(supabase, {
      organizationId: row.organization_id,
      requesterId: row.requester_id,
      approvalRequestId: row.id,
      title: row.title,
      severity: row.risk_severity,
      agentId: row.agent_id,
      requiredApprovals: row.required_approvals,
      slaDeadline: row.sla_deadline,
      aiExplanation: row.ai_explanation,
    });
  } catch (err) {
    console.error("Approval email notification failed:", err);
  }
}

export async function sendApprovalDecisionEmails(
  supabase: SupabaseClient,
  request: ApprovalRow,
  params: {
    actorId: string;
    decision: "approved" | "rejected";
    finalized: boolean;
    note?: string;
  }
): Promise<void> {
  if (!params.finalized) return;

  try {
    const actor = await getUserById(supabase, params.actorId);
    const actorName = displayName(actor ?? undefined);

    if (params.decision === "approved") {
      await notifyApprovalApproved(supabase, {
        organizationId: request.organization_id,
        requesterId: request.requester_id,
        approvalRequestId: request.id,
        title: request.title,
        severity: request.risk_severity,
        agentId: request.agent_id,
        actorName,
        note: params.note,
      });
      return;
    }

    await notifyApprovalRejected(supabase, {
      organizationId: request.organization_id,
      requesterId: request.requester_id,
      approvalRequestId: request.id,
      title: request.title,
      severity: request.risk_severity,
      agentId: request.agent_id,
      actorName,
      note: params.note,
    });
  } catch (err) {
    console.error("Approval decision email failed:", err);
  }
}
