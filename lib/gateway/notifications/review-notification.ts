import type { SupabaseClient } from "@supabase/supabase-js";
import { recordRuntimeAuditEventAsync } from "@/lib/gateway/audit/runtime-events";
import type { ActionProposalRow } from "@/lib/gateway/proposals/repository";
import { effectiveReviewDeadline } from "@/lib/gateway/review/timeout";
import { EmailBaseUrlError } from "@/lib/email/env";
import { createEmailApprovalLinks } from "@/lib/gateway/email-approval/create-token";
import { deliverNotification } from "@/lib/email/service";
import { isNotificationUniqueViolation } from "@/lib/email/notification-errors";
import {
  createNotificationRecord,
  displayName,
  findGatewayReviewNotification,
  type NotificationRow,
} from "@/lib/email/repository";
import {
  createWhatsAppNotificationRecord,
  findGatewayReviewWhatsAppNotification,
  getOrgReviewersWithChannels,
  type ReviewerWithChannels,
} from "@/lib/whatsapp/repository";
import { deliverWhatsAppNotification } from "@/lib/whatsapp/service";
import { renderWhatsAppApprovalRequest } from "@/lib/whatsapp/templates/approval-request";
import { renderEmailTemplate } from "@/lib/email/templates/render";
import type { RiskSeverity } from "@/lib/risk-types";
import {
  extractConciseRiskReasons,
  sanitizePlainEnglishSummary,
} from "./risk-reasons";
import { sanitizeNotificationText } from "./sanitize";

export interface GatewayReviewNotificationParams {
  organizationId: string;
  proposalId: string;
  agentId: string;
  toolName: string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  actionHash: string;
  plainEnglishSummary: string | null;
  riskLevel: RiskSeverity;
  riskScore: number;
  riskReasons: unknown;
  reviewExpiresAt: string | null;
}

export interface GatewayReviewNotificationDeps {
  getReviewers: typeof getOrgReviewersWithChannels;
  findExistingEmail: typeof findGatewayReviewNotification;
  findExistingWhatsApp: typeof findGatewayReviewWhatsAppNotification;
  createEmailRecord: typeof createNotificationRecord;
  createWhatsAppRecord: typeof createWhatsAppNotificationRecord;
  deliverEmail: typeof deliverNotification;
  deliverWhatsApp: typeof deliverWhatsAppNotification;
  recordAudit: typeof recordRuntimeAuditEventAsync;
  createApprovalLinks: typeof createEmailApprovalLinks;
}

const defaultDeps: GatewayReviewNotificationDeps = {
  getReviewers: getOrgReviewersWithChannels,
  findExistingEmail: findGatewayReviewNotification,
  findExistingWhatsApp: findGatewayReviewWhatsAppNotification,
  createEmailRecord: createNotificationRecord,
  createWhatsAppRecord: createWhatsAppNotificationRecord,
  deliverEmail: deliverNotification,
  deliverWhatsApp: deliverWhatsAppNotification,
  recordAudit: recordRuntimeAuditEventAsync,
  createApprovalLinks: createEmailApprovalLinks,
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
    recipientEmail?: string;
    recipientPhone?: string;
    notificationId?: string;
    actionHash: string;
    error?: string;
    channel: "email" | "whatsapp";
  }
): void {
  deps.recordAudit(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    event: params.event,
    agentId: params.agentId,
    metadata: {
      actionHash: params.actionHash,
      recipientEmail: params.recipientEmail ?? null,
      recipientPhone: params.recipientPhone ?? null,
      notificationId: params.notificationId ?? null,
      error: params.error ?? null,
      channel: params.channel,
      templateType: "gateway_review_requested",
    },
  });
}

async function queueAndDeliverEmailForReviewer(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams,
  reviewer: ReviewerWithChannels,
  deps: GatewayReviewNotificationDeps,
  approvalLinks: Awaited<ReturnType<typeof createEmailApprovalLinks>>
): Promise<"sent" | "skipped" | "failed"> {
  const existing = await deps.findExistingEmail(supabase, {
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

  const templatePayload = {
    proposalId: params.proposalId,
    agentId: sanitizeNotificationText(params.agentId, 120),
    toolName: sanitizeNotificationText(params.toolName, 120),
    actionType: sanitizeNotificationText(params.actionType, 120),
    actionPayload: params.actionPayload ?? {},
    plainEnglishSummary: sanitizePlainEnglishSummary(params.plainEnglishSummary),
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    riskReasons,
    reviewDeadline,
    approvalsUrl: approvalLinks.reviewUrl,
    approveUrl: approvalLinks.approveUrl,
    rejectUrl: approvalLinks.denyUrl,
    recipientName: displayName(reviewer),
  };

  const rendered = renderEmailTemplate("gateway_review_requested", templatePayload);

  let notification: NotificationRow;
  try {
    notification = await deps.createEmailRecord(supabase, {
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
      channel: "email",
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
    channel: "email",
  });

  try {
    await deps.deliverEmail(supabase, notification);
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.sent",
      recipientEmail: reviewer.email,
      notificationId: notification.id,
      actionHash: params.actionHash,
      channel: "email",
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
      channel: "email",
    });
    return "failed";
  }
}

async function queueAndDeliverWhatsAppForReviewer(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams,
  reviewer: ReviewerWithChannels,
  deps: GatewayReviewNotificationDeps,
  approvalLinks: Awaited<ReturnType<typeof createEmailApprovalLinks>>
): Promise<"sent" | "skipped" | "failed"> {
  const phone = reviewer.whatsapp_phone_e164;
  if (!phone || !reviewer.whatsapp_phone_verified_at) {
    return "skipped";
  }

  const existing = await deps.findExistingWhatsApp(supabase, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    recipientPhone: phone,
  });

  if (existing) {
    return "skipped";
  }

  const reviewDeadline =
    params.reviewExpiresAt ??
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const riskReasons = extractConciseRiskReasons(params.riskReasons);

  const templatePayload = {
    proposalId: params.proposalId,
    agentId: sanitizeNotificationText(params.agentId, 120),
    toolName: sanitizeNotificationText(params.toolName, 120),
    actionType: sanitizeNotificationText(params.actionType, 120),
    actionPayload: params.actionPayload ?? {},
    plainEnglishSummary: sanitizePlainEnglishSummary(params.plainEnglishSummary),
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    riskReasons,
    reviewDeadline,
    approvalsUrl: approvalLinks.reviewUrl,
    approveUrl: approvalLinks.approveUrl,
    rejectUrl: approvalLinks.denyUrl,
    recipientName: displayName(reviewer),
  };

  const rendered = renderWhatsAppApprovalRequest({
    agentId: params.agentId,
    toolName: params.toolName,
    actionType: params.actionType,
    actionPayload: params.actionPayload,
    riskLevel: params.riskLevel,
    riskScore: params.riskScore,
    approveUrl: approvalLinks.approveUrl,
    rejectUrl: approvalLinks.denyUrl,
    reviewUrl: approvalLinks.reviewUrl,
  });

  let notification: NotificationRow;
  try {
    notification = await deps.createWhatsAppRecord(supabase, {
      organizationId: params.organizationId,
      userId: reviewer.id,
      approvalRequestId: params.proposalId,
      riskTitle: `${params.toolName} — ${params.actionType}`,
      riskId: params.proposalId,
      severity: params.riskLevel,
      recipient: displayName(reviewer),
      recipientPhone: phone,
      subject: `Approval needed — ${params.toolName}`,
      preview: rendered.preview,
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
      recipientPhone: phone,
      actionHash: params.actionHash,
      error: err instanceof Error ? err.message : "Failed to queue WhatsApp notification.",
      channel: "whatsapp",
    });
    return "failed";
  }

  auditNotificationEvent(supabase, deps, {
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    agentId: params.agentId,
    event: "notification.queued",
    recipientPhone: phone,
    actionHash: params.actionHash,
    notificationId: notification.id,
    channel: "whatsapp",
  });

  try {
    await deps.deliverWhatsApp(supabase, notification);
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.sent",
      recipientPhone: phone,
      notificationId: notification.id,
      actionHash: params.actionHash,
      channel: "whatsapp",
    });
    return "sent";
  } catch (err) {
    auditNotificationEvent(supabase, deps, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      agentId: params.agentId,
      event: "notification.failed",
      recipientPhone: phone,
      notificationId: notification.id,
      actionHash: params.actionHash,
      error: err instanceof Error ? err.message : "WhatsApp delivery failed.",
      channel: "whatsapp",
    });
    return "failed";
  }
}

async function queueAndDeliverForReviewer(
  supabase: SupabaseClient,
  params: GatewayReviewNotificationParams,
  reviewer: ReviewerWithChannels,
  deps: GatewayReviewNotificationDeps
): Promise<"sent" | "skipped" | "failed"> {
  const wantsEmail = reviewer.approval_email_enabled !== false;
  const wantsWhatsApp =
    reviewer.approval_whatsapp_enabled === true &&
    Boolean(reviewer.whatsapp_phone_e164 && reviewer.whatsapp_phone_verified_at);

  if (!wantsEmail && !wantsWhatsApp) {
    return "skipped";
  }

  const reviewDeadline =
    params.reviewExpiresAt ??
    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  let approvalLinks;
  try {
    approvalLinks = await deps.createApprovalLinks(supabase, {
      organizationId: params.organizationId,
      proposalId: params.proposalId,
      reviewerId: reviewer.id,
      reviewerEmail: reviewer.email,
      expiresAt: reviewDeadline,
    });
  } catch (err) {
    if (err instanceof EmailBaseUrlError) {
      console.error("[approval-links] cannot send review notification — missing public URL:", err.message);
      auditNotificationEvent(supabase, deps, {
        organizationId: params.organizationId,
        proposalId: params.proposalId,
        agentId: params.agentId,
        event: "notification.failed",
        recipientEmail: reviewer.email,
        actionHash: params.actionHash,
        error: err.message,
        channel: wantsWhatsApp ? "whatsapp" : "email",
      });
      return "failed";
    }
    throw err;
  }

  const outcomes: Array<"sent" | "skipped" | "failed"> = [];

  if (wantsEmail) {
    outcomes.push(
      await queueAndDeliverEmailForReviewer(supabase, params, reviewer, deps, approvalLinks)
    );
  }

  if (wantsWhatsApp) {
    outcomes.push(
      await queueAndDeliverWhatsAppForReviewer(supabase, params, reviewer, deps, approvalLinks)
    );
  }

  if (outcomes.includes("sent")) return "sent";
  if (outcomes.includes("failed")) return "failed";
  return "skipped";
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
    actionPayload: row.action_payload ?? {},
    actionHash,
    plainEnglishSummary: row.plain_english_summary,
    riskLevel: (row.risk_level as RiskSeverity) || "medium",
    riskScore: row.risk_score,
    riskReasons: row.risk_reasons,
    reviewExpiresAt: row.review_expires_at ?? effectiveReviewDeadline(row),
  };
}
