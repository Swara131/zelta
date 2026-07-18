import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import { effectiveReviewDeadline } from "@/lib/gateway/review/timeout";
import { getAppUrl } from "@/lib/email/env";
import { deliverNotification } from "@/lib/email/service";
import { isNotificationUniqueViolation } from "@/lib/email/notification-errors";
import {
  createNotificationRecord,
  displayName,
  findGatewayReviewNotification,
  getOrgReviewerEmails,
  type NotificationRow,
} from "@/lib/email/repository";
import { renderEmailTemplate } from "@/lib/email/templates/render";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  extractConciseRiskReasons,
  sanitizePlainEnglishSummary,
} from "./risk-reasons";
import { buildApprovalsReviewUrl, sanitizeNotificationText } from "./sanitize";

export interface GatewayReviewNotificationParams {
  organizationId: string;
  proposalId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  actionHash: string;
  plainEnglishSummary: string | null;
  riskLevel: RiskSeverity;
  riskScore: number;
  riskReasons: unknown;
  reviewExpiresAt: string | null;
}

export interface GatewayReviewNotificationDeps {
  getReviewers: typeof getOrgReviewerEmails;
  findExisting: typeof findGatewayReviewNotification;
  createRecord: typeof createNotificationRecord;
  deliver: typeof deliverNotification;
  recordAudit: typeof recordRuntimeAuditEventAsync;
}

const defaultDeps: GatewayReviewNotificationDeps = {
  getReviewers: getOrgReviewerEmails,
  findExisting: findGatewayReviewNotification,
  createRecord: createNotificationRecord,
  deliver: deliverNotification,
  recordAudit: recordRuntimeAuditEventAsync,
};

export interface ReviewNotificationResult {
  sent: number;
  skipped: number;
  failed: number;
}

function auditNotificationEvent(
  supabase: SupabaseClient,
  deps: GatewayReviewNotificationDeps,
  params: {
    organizationId: string;
    proposalId: string;
    agentId: string;
    event: "notification.queued" | "notification.sent" | "notification.failed";
    recipientEmail: string;
    notificationId?: string;
    actionHash: string;
    error?: string;
  }
): void {
  deps.recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: params.event,
    agentId: params.agentId,
    metadata: {
      actionHash: params.actionHash,
      recipientEmail: params.recipientEmail,
      notificationId: params.notificationId ?? null,
      error: params.error ?? null,
      channel: "email",
      templateType: "gateway_review_requested",
    },
  });
}

async function queueAndDeliverForReviewer(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams,
  reviewer: { id: string; email: string; full_name: string | null },
  deps: GatewayReviewNotificationDeps
): Promise<"sent" | "skipped" | "failed"> {
  const existing = await deps.findExisting(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    recipientEmail: reviewer.email,
  });

  if (existing) {
    return "skipped";
  }

  const reviewDeadline =
    params.reviewExpiresAt ??
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const riskReasons = extractConciseRiskReasons(params.riskReasons);
  const appUrl = getAppUrl();

  const templatePayload = {
    proposalId: params.proposalId,
    agentId: sanitizeNotificationText(params.agentId, 120),
    toolName: sanitizeNotificationText(params.toolName, 120),
    actionType: sanitizeNotificationText(params.actionType, 120),
    plainEnglishSummary: sanitizePlainEnglishSummary(params.plainEnglishSummary),
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    riskReasons,
    reviewDeadline,
    approvalsUrl: buildApprovalsReviewUrl(params.proposalId, appUrl),
    recipientName: displayName(reviewer),
  };

  const rendered = renderEmailTemplate("gateway_review_requested", templatePayload);

  let notification: NotificationRow;
  try {
    notification = await deps.createRecord(supabase, {
      organizationId: params.organizationId,
      userId: reviewer.id,
      approvalRequestId: params.proposalId,
      riskTitle: `${params.toolName} — ${params.actionType}`,
      riskId: params.proposalId,
      severity: params.riskLevel,
      recipient: displayName(reviewer),
      recipientEmail: reviewer.email,
      subject: rendered.subject,
      preview: rendered.preview,
      templateType: "gateway_review_requested",
      templatePayload,
    });
  } catch (err) {
    if (isNotificationUniqueViolation(err)) {
      return "skipped";
    }
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.failed",
      recipientEmail: reviewer.email,
      actionHash: params.actionHash,
      error: err instanceof Error ? err.message : "Failed to queue notification.",
    });
    return "failed";
  }

  auditNotificationEvent(supabase, deps, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    agentId: params.agentId,
    event: "notification.queued",
    recipientEmail: reviewer.email,
    actionHash: params.actionHash,
    notificationId: notification.id,
  });

  try {
    await deps.deliver(supabase, notification);
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.sent",
      recipientEmail: reviewer.email,
      notificationId: notification.id,
      actionHash: params.actionHash,
    });
    return "sent";
  } catch (err) {
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.failed",
      recipientEmail: reviewer.email,
      notificationId: notification.id,
      actionHash: params.actionHash,
      error: err instanceof Error ? err.message : "Email delivery failed.",
    });
    return "failed";
  }
}

/**
 * Notifies org reviewers after a REVIEW proposal is durably persisted.
 * Failures are logged and audited; they never roll back the proposal.
 */
export async function notifyGatewayReviewRequired(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams,
  deps: Partial<GatewayReviewNotificationDeps> = {}
): Promise<ReviewNotificationResult> {
  const resolved: GatewayReviewNotificationDeps = { ...defaultDeps, ...deps };
  const result: ReviewNotificationResult = { sent: 0, skipped: 0, failed: 0 };

  try {
    const reviewers = await resolved.getReviewers(supabase, params.organizationId);
    if (reviewers.length === 0) {
      return result;
    }

    for (const reviewer of reviewers) {
      const outcome = await queueAndDeliverForReviewer(
        supabase,
        params,
        reviewer,
        resolved
      );
      result[outcome] += 1;
    }
  } catch (err) {
    console.error("[gateway] Review notification email failed:", err);
  }

  return result;
}

/** Builds notification params from a persisted review_required proposal row. */
export function buildGatewayReviewNotificationParams(
  row: ActionProposalRow,
  actionHash: string
): GatewayReviewNotificationParams | null {
  if (row.status !== "review_required") {
    return null;
  }

  return {
    organizationId: row.organization_id,
    proposalId: row.id,
    agentId: row.agent_id,
    toolName: row.tool_name,
    actionType: row.action_type,
    actionHash,
    plainEnglishSummary: row.plain_english_summary,
    riskLevel: (row.risk_level as RiskSeverity) || "medium",
    riskScore: row.risk_score,
    riskReasons: row.risk_reasons,
    reviewExpiresAt: row.review_expires_at ?? effectiveReviewDeadline(row),
  };
}
